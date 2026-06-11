import { exec } from "child_process";
import { promisify } from "util";
import { readFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";
import { getDb } from "~/server/database";
import {
  docGenerationJobs,
  docGenerationRepoResults,
  docGenerationDebugLogs,
  appRepositories,
  apps,
} from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { createAgent } from "./agent-factory";
import type { Agent, AnalyzeOptions } from "./agent-factory";
import {
  cloneOrPull,
  diffSinceRef,
  openPullRequest,
  parseRepo,
  type GitProvider,
} from "./git-provider";
import { stripGeneratedDocArtifacts } from "./generated-doc";
import { readExistingDoc } from "./existing-doc";
import { DEFAULT_DOC_PATHS } from "./doc-paths";
import {
  buildPrdCreatePrompt,
  buildPrdUpdatePrompt,
  buildFsdCreatePrompt,
  buildFsdUpdatePrompt,
  buildSddCreatePrompt,
  buildSddUpdatePrompt,
  buildSddDiffUpdatePrompt,
} from "./doc-prompts";

const execAsync = promisify(exec);

// Clone into a writable temp dir so it works on serverless (ephemeral) FS too.
const REPO_DIR = join(tmpdir(), "orbit-docs-repositories");

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

export type DocType = "srs" | "fsd" | "sdd";
export type GenerationStatus =
  | "cloning"
  | "analyzing"
  | "generating_srs"
  | "generating_fsd"
  | "generating_sdd"
  | "writing_back"
  | "completed"
  | "failed"
  | "cancelled";

interface ProgressUpdate {
  status: GenerationStatus;
  progressPct: number;
  progressMessage: string;
}

type ProgressCallback = (update: ProgressUpdate) => void | Promise<void>;

async function loadTemplate(type: DocType): Promise<string> {
  const templatePath = join(process.cwd(), "templates", `${type}_template.md`);
  return readFile(templatePath, "utf-8");
}

async function getRepoStructure(repoDir: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `find "${repoDir}" -type f -not -path '*/\\.git/*' -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/build/*' | head -100`,
      { timeout: 30000 }
    );
    return stdout;
  } catch {
    return "Could not retrieve file structure";
  }
}

async function getKeyFileNames(repoDir: string): Promise<string[]> {
  const keyFiles = [
    "README.md",
    "package.json",
    "nuxt.config.ts",
    "next.config.js",
    "tsconfig.json",
    "docker-compose.yml",
    "Dockerfile",
    ".env.example",
  ];
  const found: string[] = [];
  for (const file of keyFiles) {
    if (existsSync(join(repoDir, file))) found.push(file);
  }
  return found;
}

async function getRepoRef(cloneDir: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `git -C "${cloneDir}" describe --tags --abbrev=0`,
      { timeout: 30000 }
    );
    const tag = stdout.trim();
    if (tag) return tag;
  } catch {
    // no tags
  }
  try {
    const { stdout } = await execAsync(
      `git -C "${cloneDir}" rev-parse HEAD`,
      { timeout: 30000 }
    );
    const hash = stdout.trim();
    if (hash) return hash;
  } catch {
    // ignore
  }
  return null;
}

// ── Job DB helpers ─────────────────────────────────────────────
async function updateJobProgress(
  jobId: string,
  update: ProgressUpdate
): Promise<void> {
  const db = getDb();
  await db
    .update(docGenerationJobs)
    .set({
      status: update.status,
      progressPct: update.progressPct,
      progressMessage: update.progressMessage,
    })
    .where(eq(docGenerationJobs.id, jobId));
}

async function updateJobResult(
  jobId: string,
  type: DocType,
  content: string
): Promise<void> {
  const db = getDb();
  const updateField =
    type === "srs"
      ? { srsContent: content }
      : type === "fsd"
      ? { fsdContent: content }
      : { sddContent: content };
  await db
    .update(docGenerationJobs)
    .set(updateField)
    .where(eq(docGenerationJobs.id, jobId));
}

async function updateJobCompletion(
  jobId: string,
  success: boolean,
  error?: string
): Promise<void> {
  const db = getDb();
  await db
    .update(docGenerationJobs)
    .set({
      status: success ? "completed" : "failed",
      progressPct: success ? 100 : 0,
      progressMessage: success ? "Generation completed" : error || "Failed",
      completedAt: success ? new Date() : null,
      errorMessage: success ? null : error || null,
      // Clear the live-progress fields so the UI shows the final state, not
      // whatever the agent was doing right before completion/failure.
      currentActivity: null,
      partialContent: null,
    })
    .where(eq(docGenerationJobs.id, jobId));
}

async function isJobCancelled(jobId: string): Promise<boolean> {
  const db = getDb();
  const job = await db
    .select({ status: docGenerationJobs.status })
    .from(docGenerationJobs)
    .where(eq(docGenerationJobs.id, jobId))
    .limit(1)
    .then((rows) => rows[0]);
  return job?.status === "cancelled";
}

/**
 * Update the live progress fields on a job. Coalesces partial writes so the
 * caller can fire it on every event without hammering Postgres.
 */
async function updateJobLiveProgress(
  jobId: string,
  patch: Partial<{
    currentActivity: string | null;
    partialContent: string | null;
    tokensInput: number;
    tokensOutput: number;
  }>
): Promise<void> {
  const db = getDb();
  await db
    .update(docGenerationJobs)
    .set({ ...patch, lastEventAt: new Date() })
    .where(eq(docGenerationJobs.id, jobId));
}

async function updateJobSessionId(jobId: string, sessionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(docGenerationJobs)
    .set({ opencodeSessionId: sessionId })
    .where(eq(docGenerationJobs.id, jobId));
}

interface DebugEvent {
  type: string;
  payload: Record<string, unknown>;
}

/** Buffers debug events and flushes them to the DB in batches. */
function createDebugEventBuffer(jobId: string, flushMs = 2000, maxSize = 100) {
  const buffer: DebugEvent[] = [];
  let flushing = false;

  const flush = async () => {
    if (buffer.length === 0 || flushing) return;
    flushing = true;
    const batch = buffer.splice(0, buffer.length);
    try {
      const db = getDb();
      await db.insert(docGenerationDebugLogs).values(
        batch.map((ev) => ({
          jobId,
          eventType: ev.type,
          eventData: JSON.stringify(ev.payload),
        }))
      );
    } catch (e) {
      console.warn("[doc-generator] debug log flush failed:", e);
    } finally {
      flushing = false;
    }
  };

  const timer = setInterval(flush, flushMs);

  return {
    push(ev: DebugEvent) {
      buffer.push(ev);
      if (buffer.length >= maxSize) {
        flush().catch(() => {});
      }
    },
    async dispose() {
      clearInterval(timer);
      await flush();
    },
  };
}

/**
 * Wrap `agent.analyze` so it streams live progress (activity line + partial
 * content + token counts) into the job row at most every `flushMs`, and so
 * the run is automatically aborted when the job is cancelled in the DB.
 */
async function runAgentAnalyze(
  agent: Agent,
  jobId: string,
  prompt: string,
  workdir: string,
  opts: { partialField?: "srs" | "fsd" | "sdd"; flushMs?: number; cursorModel?: string } = {}
): Promise<string> {
  const { flushMs = 1500 } = opts;

  let pendingActivity: string | null = null;
  let pendingPartial: string | null = null;
  let pendingTokens: { input: number; output: number } | null = null;
  let dirty = false;
  let flushing = false;

  const debugBuffer = createDebugEventBuffer(jobId);

  const flush = async () => {
    if (!dirty || flushing) return;
    flushing = true;
    try {
      const patch: Parameters<typeof updateJobLiveProgress>[1] = {};
      if (pendingActivity !== null) patch.currentActivity = pendingActivity;
      if (pendingPartial !== null) patch.partialContent = pendingPartial;
      if (pendingTokens) {
        patch.tokensInput = pendingTokens.input;
        patch.tokensOutput = pendingTokens.output;
      }
      dirty = false;
      await updateJobLiveProgress(jobId, patch);
    } catch (e) {
      console.warn("[doc-generator] live-progress flush failed:", e);
    } finally {
      flushing = false;
    }
  };

  const flushTimer = setInterval(flush, flushMs);

  // Poll the job status so an external "cancel" in the DB aborts the run.
  const ac = new AbortController();
  const cancelPoll = setInterval(async () => {
    try {
      if (await isJobCancelled(jobId)) {
        ac.abort();
      }
    } catch { /* swallow */ }
  }, 2_000);

  try {
    const result = await agent.analyze(prompt, {
      workdir,
      signal: ac.signal,
      onActivity: (activity) => {
        pendingActivity = activity;
        dirty = true;
      },
      onText: (_delta, accumulated) => {
        pendingPartial = accumulated;
        dirty = true;
      },
      onTokens: (tokens) => {
        pendingTokens = tokens;
        dirty = true;
      },
      onDebugEvent: (event) => {
        if (event.type === "session.created" && typeof event.payload.sessionId === "string") {
          updateJobSessionId(jobId, event.payload.sessionId).catch(() => {});
        }
        debugBuffer.push(event);
      },
    } satisfies AnalyzeOptions);

    // Final flush so the UI sees the last activity update.
    pendingActivity = null;
    pendingPartial = null;
    dirty = true;
    await flush();

    return stripGeneratedDocArtifacts(result, opts.partialField);
  } finally {
    clearInterval(flushTimer);
    clearInterval(cancelPoll);
    await debugBuffer.dispose();
  }
}

// ── Repo result helpers ────────────────────────────────────────
async function createRepoResult(
  jobId: string,
  repoId: string | null,
  repoUrl: string
): Promise<string> {
  const db = getDb();
  const row = await db
    .insert(docGenerationRepoResults)
    .values({ jobId, repoId, repoUrl, status: "pending" })
    .returning()
    .then((rows) => rows[0]);
  return row.id;
}

async function updateRepoResult(
  resultId: string,
  patch: Partial<{
    repoRef: string;
    sddContent: string;
    status: "pending" | "generating" | "writing_back" | "completed" | "failed";
    prUrl: string;
    errorMessage: string | null;
  }>
): Promise<void> {
  const db = getDb();
  await db
    .update(docGenerationRepoResults)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(docGenerationRepoResults.id, resultId));
}

async function updateRepoLastProcessedRef(
  repoId: string,
  ref: string
): Promise<void> {
  const db = getDb();
  await db
    .update(appRepositories)
    .set({ lastProcessedRef: ref, updatedAt: new Date() })
    .where(eq(appRepositories.id, repoId));
}

interface RepoRow {
  id: string | null;
  name: string;
  repoUrl: string;
  provider: GitProvider;
  hostUrl: string | null;
  defaultBranch: string;
  accessToken: string | null;
  sddDocPath: string;
  lastProcessedRef: string | null;
}

/**
 * Load the repositories for an app. Falls back to the legacy single
 * apps.repoUrl when no app_repositories rows exist (backward compatible).
 */
async function loadAppRepos(appId: string): Promise<RepoRow[]> {
  const db = getDb();
  const repos = await db
    .select()
    .from(appRepositories)
    .where(eq(appRepositories.appId, appId));

  if (repos.length > 0) {
    return repos.map((r) => ({
      id: r.id,
      name: r.name,
      repoUrl: r.repoUrl,
      provider: (r.provider as GitProvider) || "github",
      hostUrl: r.hostUrl ?? null,
      defaultBranch: r.defaultBranch || "main",
      accessToken: r.accessToken,
      sddDocPath: r.sddDocPath || "docs/SDD.md",
      lastProcessedRef: r.lastProcessedRef,
    }));
  }

  const app = await db
    .select({ repoUrl: apps.repoUrl })
    .from(apps)
    .where(eq(apps.id, appId))
    .limit(1)
    .then((rows) => rows[0]);

  if (app?.repoUrl) {
    return [
      {
        id: null,
        name: getRepoName(app.repoUrl),
        repoUrl: app.repoUrl,
        provider: "github",
        hostUrl: null,
        defaultBranch: "main",
        accessToken: null,
        sddDocPath: "docs/SDD.md",
        lastProcessedRef: null,
      },
    ];
  }

  return [];
}

function getRepoName(repoUrl: string): string {
  const clean = repoUrl.replace(/\.git$/, "");
  const parts = clean.split("/");
  return parts[parts.length - 1] || "repo";
}

/**
 * For Option B (minimal, no schema changes), the product docs repo is the first
 * repo in loadAppRepos() order. PRD and FSD live there at fixed paths.
 */
function resolveProductDocsRepo(repos: RepoRow[]): RepoRow {
  if (repos.length === 0) {
    throw new Error("No repositories configured for this app");
  }
  return repos[0];
}

/** Write a document back to a repo via a PR/MR when credentials are available. */
async function writeDocBack(
  repo: RepoRow,
  cloneDir: string,
  filePath: string,
  fileContent: string,
  ref: string | null,
  docLabel: string
): Promise<string | null> {
  if (!repo.accessToken) return null;

  const suffix = (ref || Date.now().toString()).replace(/[^a-zA-Z0-9._-]/g, "-");
  const slug = docLabel.toLowerCase().replace(/\s+/g, "-");
  const branchName = `orbit-docs/${slug}-update-${suffix}`;
  const refLabel = ref ? ` for ${ref}` : "";
  const isUpdate = true; // We always update the same path; PR title reflects this

  return await openPullRequest({
    provider: repo.provider,
    hostUrl: repo.hostUrl,
    repoUrl: repo.repoUrl,
    token: repo.accessToken,
    cloneDir,
    baseBranch: repo.defaultBranch,
    filePath,
    fileContent,
    branchName,
    commitMessage: `docs: update ${docLabel}${refLabel}`,
    prTitle: `Update ${docLabel}${refLabel}`,
    prBody:
      `This PR updates the ${docLabel} at \`${filePath}\`.\n\n` +
      `Generated automatically by Orbit Docs.`,
  });
}

/**
 * Product-scoped run: PRD + FSD aggregated across all of the app's
 * repositories, then a per-repository SDD that is written back via PR.
 */
export async function generateProductDocs(
  jobId: string,
  appId: string,
  onProgress: ProgressCallback,
  opts: { cursorModel?: string } = {}
): Promise<void> {
  const agent = createAgent({ model: opts.cursorModel });
  const baseDir = join(REPO_DIR, appId);

  try {
    const repos = await loadAppRepos(appId);
    if (repos.length === 0) {
      throw new Error("No repositories configured for this app");
    }

    // Step 1: Clone/pull every repo
    await onProgress({
      status: "cloning",
      progressPct: 5,
      progressMessage: `Cloning ${repos.length} repositor${repos.length === 1 ? "y" : "ies"}...`,
    });
    if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

    await ensureDir(baseDir);
    const cloneDirs: Record<string, string> = {};
    for (const repo of repos) {
      const dir = join(baseDir, getRepoName(repo.repoUrl));
      await cloneOrPull(repo.repoUrl, dir, repo.provider, repo.accessToken, false, repo.hostUrl);
      cloneDirs[repo.repoUrl] = dir;
    }

    // Step 2: Analyze (build aggregate context)
    await onProgress({
      status: "analyzing",
      progressPct: 20,
      progressMessage: "Analyzing repositories...",
    });
    if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

    const repoSummaries: string[] = [];
    for (const repo of repos) {
      const dir = cloneDirs[repo.repoUrl];
      const structure = await getRepoStructure(dir);
      const keyFiles = await getKeyFileNames(dir);
      repoSummaries.push(
        `### Repository: ${repo.name} (${repo.repoUrl})\nLocal path: ${dir}\nKey files: ${keyFiles.join(", ") || "none"}\nStructure:\n${structure}`
      );
    }
    const aggregateContext = `This product is composed of ${repos.length} repositories. Analyze ALL of them.\n\n${repoSummaries.join("\n\n")}`;

    // Resolve product docs repo (Option B: first repo in order)
    const productRepo = resolveProductDocsRepo(repos);
    const productDir = cloneDirs[productRepo.repoUrl];

    // Step 3: PRD (stored internally as srs)
    const prdDocPath = DEFAULT_DOC_PATHS.prdDocPath;
    const existingPrd = await readExistingDoc(productDir, prdDocPath, "srs");
    const prdTemplate = await loadTemplate("srs");

    await onProgress({
      status: "generating_srs",
      progressPct: 40,
      progressMessage: existingPrd
        ? `Updating existing PRD at ${prdDocPath}...`
        : "Generating Product Requirements Document (first run)...",
    });
    if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

    const prdPrompt = existingPrd
      ? buildPrdUpdatePrompt(existingPrd, aggregateContext, baseDir)
      : buildPrdCreatePrompt(prdTemplate, aggregateContext, baseDir);

    const prdContent = await runAgentAnalyze(agent, jobId, prdPrompt, baseDir, {
      partialField: "srs",
    });
    await updateJobResult(jobId, "srs", prdContent);
    // Clear the live partial buffer now that the PRD is final.
    await updateJobLiveProgress(jobId, { partialContent: null, currentActivity: null });

    // Step 4: FSD (product-level)
    const fsdDocPath = DEFAULT_DOC_PATHS.fsdDocPath;
    const existingFsd = await readExistingDoc(productDir, fsdDocPath, "fsd");
    const fsdTemplate = await loadTemplate("fsd");

    await onProgress({
      status: "generating_fsd",
      progressPct: 60,
      progressMessage: existingFsd
        ? `Updating existing FSD at ${fsdDocPath}...`
        : "Generating Functional Specification Document (first run)...",
    });
    if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

    const fsdPrompt = existingFsd
      ? buildFsdUpdatePrompt(existingFsd, aggregateContext, baseDir, prdContent.substring(0, 2000))
      : buildFsdCreatePrompt(fsdTemplate, aggregateContext, baseDir, prdContent.substring(0, 2000));

    const fsdContent = await runAgentAnalyze(agent, jobId, fsdPrompt, baseDir, {
      partialField: "fsd",
    });
    await updateJobResult(jobId, "fsd", fsdContent);
    await updateJobLiveProgress(jobId, { partialContent: null, currentActivity: null });

    // Step 5: Write PRD + FSD back to product docs repo
    if (productRepo.accessToken) {
      await onProgress({
        status: "writing_back",
        progressPct: 70,
        progressMessage: `Opening PR for product docs (${productRepo.name})...`,
      });

      const productRef = await getRepoRef(productDir);

      await writeDocBack(
        productRepo,
        productDir,
        prdDocPath,
        prdContent,
        productRef,
        "Product Requirements Document"
      );

      await writeDocBack(
        productRepo,
        productDir,
        fsdDocPath,
        fsdContent,
        productRef,
        "Functional Specification Document"
      );
    }

    // Step 6: Per-repo SDD + write-back
    await onProgress({
      status: "generating_sdd",
      progressPct: 75,
      progressMessage: "Generating System Design Documents per repository...",
    });

    const sddTemplate = await loadTemplate("sdd");
    let lastSdd = "";
    for (const repo of repos) {
      if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

      const dir = cloneDirs[repo.repoUrl];
      const resultId = await createRepoResult(jobId, repo.id, repo.repoUrl);
      await updateRepoResult(resultId, { status: "generating" });

      try {
        const structure = await getRepoStructure(dir);
        const keyFiles = await getKeyFileNames(dir);
        const repoContext = `Repository: ${repo.name} (${repo.repoUrl})\nLocal path: ${dir}\nKey files: ${keyFiles.join(", ") || "none"}\nStructure:\n${structure}`;

        const existingSdd = await readExistingDoc(dir, repo.sddDocPath, "sdd");

        const sddPrompt = existingSdd
          ? buildSddUpdatePrompt(
              existingSdd,
              dir,
              repo.name,
              repoContext,
              prdContent.substring(0, 1500),
              fsdContent.substring(0, 1500)
            )
          : buildSddCreatePrompt(
              sddTemplate,
              dir,
              repo.name,
              repoContext,
              prdContent.substring(0, 1500),
              fsdContent.substring(0, 1500)
            );

        const sddContent = await runAgentAnalyze(agent, jobId, sddPrompt, dir, {
          partialField: "sdd",
        });
        lastSdd = sddContent;
        const ref = await getRepoRef(dir);
        await updateRepoResult(resultId, {
          sddContent,
          repoRef: ref || undefined,
          status: "writing_back",
        });

        // Write back to the repo via PR (only when a token is configured)
        let prUrl: string | null = null;
        if (repo.accessToken) {
          await onProgress({
            status: "writing_back",
            progressPct: 90,
            progressMessage: `Opening PR for ${repo.name}...`,
          });
          prUrl = await writeDocBack(
            repo,
            dir,
            repo.sddDocPath,
            sddContent,
            ref,
            "System Design Document"
          );
        }

        await updateRepoResult(resultId, {
          status: "completed",
          prUrl: prUrl || undefined,
        });

        if (repo.id && ref) {
          await updateRepoLastProcessedRef(repo.id, ref);
        }
      } catch (repoErr) {
        const msg =
          repoErr instanceof Error ? repoErr.message : "SDD generation failed";
        await updateRepoResult(resultId, {
          status: "failed",
          errorMessage: msg,
        });
        // Continue with the other repositories
      }
    }

    // Keep a copy of the last SDD on the job for backward compatibility
    if (lastSdd) await updateJobResult(jobId, "sdd", lastSdd);

    if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");
    await updateJobCompletion(jobId, true);
    await onProgress({
      status: "completed",
      progressPct: 100,
      progressMessage: "Generation completed successfully",
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error during generation";
    const wasCancelled = errorMessage === "Generation cancelled";
    if (!wasCancelled) {
      await updateJobCompletion(jobId, false, errorMessage);
      await onProgress({
        status: "failed",
        progressPct: 0,
        progressMessage: errorMessage,
      });
    }
    throw error;
  }
}

/**
 * Repo-scoped run (typically webhook-triggered): regenerate ONLY this repo's
 * SDD using a diff since the last processed tag, then open a PR. Token-
 * efficient: only changed files / the diff are sent to the agent.
 */
export async function generateRepoSdd(
  jobId: string,
  repoId: string,
  newTag: string,
  onProgress: ProgressCallback,
  opts: { cursorModel?: string } = {}
): Promise<void> {
  const db = getDb();
  const agent = createAgent({ model: opts.cursorModel });

  try {
    const repoRow = await db
      .select()
      .from(appRepositories)
      .where(eq(appRepositories.id, repoId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!repoRow) throw new Error("Repository not found");

    const repo: RepoRow = {
      id: repoRow.id,
      name: repoRow.name,
      repoUrl: repoRow.repoUrl,
      provider: (repoRow.provider as GitProvider) || "github",
      hostUrl: repoRow.hostUrl ?? null,
      defaultBranch: repoRow.defaultBranch || "main",
      accessToken: repoRow.accessToken,
      sddDocPath: repoRow.sddDocPath || "docs/SDD.md",
      lastProcessedRef: repoRow.lastProcessedRef,
    };

    const dir = join(REPO_DIR, repoRow.appId, getRepoName(repo.repoUrl));
    const resultId = await createRepoResult(jobId, repo.id, repo.repoUrl);

    // Step 1: Clone/pull with full history (needed to diff between tags)
    await onProgress({
      status: "cloning",
      progressPct: 10,
      progressMessage: `Updating ${repo.name}...`,
    });
    await ensureDir(join(REPO_DIR, repoRow.appId));
    await cloneOrPull(repo.repoUrl, dir, repo.provider, repo.accessToken, true, repo.hostUrl);

    // Step 2: Compute diff since the last processed ref
    await onProgress({
      status: "analyzing",
      progressPct: 30,
      progressMessage: `Diffing ${repo.lastProcessedRef || "(none)"} → ${newTag}...`,
    });
    await updateRepoResult(resultId, { status: "generating", repoRef: newTag });

    const { changedFiles, patch } = await diffSinceRef(
      dir,
      repo.lastProcessedRef,
      newTag
    );

    // Read existing SDD from repo file (file-first approach)
    const existingSdd = await readExistingDoc(dir, repo.sddDocPath, "sdd");
    const sddTemplate = await loadTemplate("sdd");

    // Step 3: Generate / update SDD
    await onProgress({
      status: "generating_sdd",
      progressPct: 55,
      progressMessage: existingSdd
        ? `Updating existing SDD at ${repo.sddDocPath}...`
        : "Generating System Design Document (first run)...",
    });

    let sddContent: string;
    if (existingSdd && changedFiles.length > 0) {
      // Token-efficient incremental update: feed only the diff + existing SDD
      const prompt = buildSddDiffUpdatePrompt(
        existingSdd,
        repo.name,
        dir,
        newTag,
        changedFiles,
        patch
      );
      sddContent = await runAgentAnalyze(agent, jobId, prompt, dir, {
        partialField: "sdd",
      });
    } else if (existingSdd) {
      // File exists but no diff / first tag — full codebase refresh but UPDATE mode
      const structure = await getRepoStructure(dir);
      const keyFiles = await getKeyFileNames(dir);
      const repoContext = `Repository: ${repo.name} (${repo.repoUrl})\nLocal path: ${dir}\nKey files: ${keyFiles.join(", ") || "none"}\nStructure:\n${structure}`;
      const prompt = buildSddUpdatePrompt(
        existingSdd,
        dir,
        repo.name,
        repoContext,
        "(not available for repo-scoped run)",
        "(not available for repo-scoped run)"
      );
      sddContent = await runAgentAnalyze(agent, jobId, prompt, dir, {
        partialField: "sdd",
      });
    } else {
      // No existing SDD — create from template
      const structure = await getRepoStructure(dir);
      const keyFiles = await getKeyFileNames(dir);
      const repoContext = `Repository: ${repo.name} (${repo.repoUrl})\nLocal path: ${dir}\nKey files: ${keyFiles.join(", ") || "none"}\nStructure:\n${structure}`;
      const prompt = buildSddCreatePrompt(
        sddTemplate,
        dir,
        repo.name,
        repoContext,
        "(not available for repo-scoped run)",
        "(not available for repo-scoped run)"
      );
      sddContent = await runAgentAnalyze(agent, jobId, prompt, dir, {
        partialField: "sdd",
      });
    }

    await updateRepoResult(resultId, {
      sddContent,
      status: "writing_back",
    });
    await updateJobResult(jobId, "sdd", sddContent);

    // Step 4: Write back via PR
    let prUrl: string | null = null;
    if (repo.accessToken) {
      await onProgress({
        status: "writing_back",
        progressPct: 85,
        progressMessage: `Opening PR for ${repo.name}...`,
      });
      prUrl = await writeDocBack(
        repo,
        dir,
        repo.sddDocPath,
        sddContent,
        newTag,
        "System Design Document"
      );
    }

    await updateRepoResult(resultId, {
      status: "completed",
      prUrl: prUrl || undefined,
    });
    await updateRepoLastProcessedRef(repoId, newTag);

    await updateJobCompletion(jobId, true);
    await onProgress({
      status: "completed",
      progressPct: 100,
      progressMessage: `SDD updated for ${repo.name}`,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error during generation";
    await updateJobCompletion(jobId, false, errorMessage);
    await onProgress({
      status: "failed",
      progressPct: 0,
      progressMessage: errorMessage,
    });
    throw error;
  }
}

export { updateJobProgress };
