import { exec } from "child_process";
import { promisify } from "util";
import { readFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { getRepoDir } from "~/server/utils/repo-dir";
import { getDb } from "~/server/database";
import {
  docGenerationJobs,
  docGenerationRepoResults,
  docGenerationDebugLogs,
  docGenerationVersions,
  appRepositories,
  apps,
  users,
} from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { createAgent } from "./agent-factory";
import type { Agent, AnalyzeOptions } from "./agent-factory";
import {
  cloneOrPull,
  diffSinceRef,
  openPullRequest,
  type GitProvider,
} from "./git-provider";
import { autoMergePullRequest, type PrMergeStatus } from "./git-merge";
import { getDocGenerationSettings } from "./doc-generation-settings";
import { readExistingDoc } from "./existing-doc";
import {
  readProductDocForGeneration,
  saveAppProductDoc,
  generationDocTypeToAppDocType,
  type GenerationProductDocType,
} from "./app-product-docs";
import { DEFAULT_DOC_PATHS } from "./doc-paths";
import {
  buildPrdCreatePrompt,
  buildPrdUpdatePrompt,
  buildFsdCreatePrompt,
  buildFsdUpdatePrompt,
  buildSddCreatePrompt,
  buildSddUpdatePrompt,
  buildSddDiffUpdatePrompt,
  buildDocFileOutputInstructions,
  buildDocFileRetryPrompt,
  prependAdrConstraints,
  buildWikiOutlinePrompt,
  buildWikiPagePrompt,
  parseWikiOutlineJson,
} from "./doc-prompts";
import { formatAdrConstraintSummary, listBindingAdrs } from "./adr-queries";
import { checkAdrCompliance } from "./adr-verification";
import {
  createOrUpdateWikiSite,
  planPageTitle,
  wikiPageSortOrder,
  type WikiPageContent,
} from "./wiki-site-builder";
import { sanitizeWikiMarkdown } from "~/utils/wiki-markdown";
import {
  resolveAgentDocOutput,
  assertValidGeneratedDoc,
  preferDiskDocOutput,
  validateGeneratedDocContent,
} from "./agent-doc-output";
import type { GeneratedDocType } from "./generated-doc";

const execAsync = promisify(exec);

const GIT_SNAPSHOT_DOC_PATH = "docs/GIT-SNAPSHOT.md";
const SDD_INDEX_DOC_PATH = "docs/SDD.md";

async function withAdrConstraints(
  appId: string,
  prompt: string,
  options?: { isUpdate?: boolean }
): Promise<string> {
  const constraints = await formatAdrConstraintSummary(
    await listBindingAdrs(getDb(), appId, { includeContent: true })
  );
  return prependAdrConstraints(prompt, constraints, options);
}

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

export type DocType = "srs" | "fsd" | "git_snapshot" | "sdd" | "sdd_index";
export type SddRepoType = "backend" | "frontend" | "mobile" | "generic";
export type GenerationStatus =
  | "cloning"
  | "analyzing"
  | "generating_srs"
  | "generating_fsd"
  | "generating_git_snapshot"
  | "generating_sdd_index"
  | "generating_sdd"
  | "generating_wiki_outline"
  | "generating_wiki_pages"
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

async function loadWikiTemplate(kind: "overview" | "page"): Promise<string> {
  const file = kind === "overview" ? "wiki_overview_template.md" : "wiki_page_template.md";
  return readFile(join(process.cwd(), "templates", file), "utf-8");
}

async function loadTemplate(type: DocType | SddRepoType): Promise<string> {
  const file =
    type === "backend"
      ? "sdd_backend_template.md"
      : type === "frontend"
      ? "sdd_frontend_template.md"
      : type === "mobile"
      ? "sdd_mobile_template.md"
      : type === "git_snapshot"
      ? "git_snapshot_template.md"
      : type === "sdd_index"
      ? "sdd_template.md"
      : `${type}_template.md`;
  const templatePath = join(process.cwd(), "templates", file);
  return readFile(templatePath, "utf-8");
}

function detectRepoType(repoDir: string): SddRepoType {
  if (existsSync(join(repoDir, "pubspec.yaml"))) return "mobile";
  if (
    existsSync(join(repoDir, "nuxt.config.ts")) ||
    existsSync(join(repoDir, "vite.config.ts")) ||
    existsSync(join(repoDir, "next.config.js")) ||
    existsSync(join(repoDir, "next.config.mjs"))
  ) {
    return "frontend";
  }
  if (
    existsSync(join(repoDir, "go.mod")) ||
    existsSync(join(repoDir, "main.go")) ||
    existsSync(join(repoDir, "Cargo.toml"))
  ) {
    return "backend";
  }
  return "generic";
}

function sddFilenameForRepoType(repoType: SddRepoType, repoName: string): string {
  if (repoType === "backend") return "SDD-Backend.md";
  if (repoType === "frontend") return "SDD-Frontend.md";
  if (repoType === "mobile") return "SDD-Mobile.md";
  return `SDD-${repoName}.md`;
}

interface GitRepoMetadata {
  dirName: string;
  repoUrl: string;
  remoteUrl: string;
  branch: string;
  tag: string | null;
  shortSha: string;
  fullSha: string;
  commitDate: string;
  subject: string;
}

async function collectGitMetadata(
  repos: RepoRow[],
  cloneDirs: Record<string, string>
): Promise<GitRepoMetadata[]> {
  const results: GitRepoMetadata[] = [];
  for (const repo of repos) {
    const dir = cloneDirs[repo.repoUrl];
    const dirName = getRepoName(repo.repoUrl);
    let remoteUrl = repo.repoUrl;
    let branch = repo.defaultBranch;
    let tag: string | null = null;
    let shortSha = "";
    let fullSha = "";
    let commitDate = "";
    let subject = "";

    try {
      const { stdout: remoteOut } = await execAsync(
        `git -C "${dir}" remote get-url origin`,
        { timeout: 10000 }
      );
      remoteUrl = remoteOut.trim() || repo.repoUrl;
    } catch {
      // keep repoUrl
    }

    try {
      const { stdout: branchOut } = await execAsync(
        `git -C "${dir}" rev-parse --abbrev-ref HEAD`,
        { timeout: 10000 }
      );
      branch = branchOut.trim() || repo.defaultBranch;
    } catch {
      // keep default
    }

    try {
      const { stdout: tagOut } = await execAsync(
        `git -C "${dir}" describe --tags --abbrev=0`,
        { timeout: 10000 }
      );
      tag = tagOut.trim() || null;
    } catch {
      tag = null;
    }

    try {
      const { stdout: logOut } = await execAsync(
        `git -C "${dir}" log -1 --format='%h|%H|%ci|%s'`,
        { timeout: 10000 }
      );
      const [short, full, date, ...rest] = logOut.trim().split("|");
      shortSha = short || "";
      fullSha = full || "";
      commitDate = date || "";
      subject = rest.join("|") || "";
    } catch {
      // leave empty
    }

    results.push({
      dirName,
      repoUrl: repo.repoUrl,
      remoteUrl,
      branch,
      tag,
      shortSha,
      fullSha,
      commitDate,
      subject,
    });
  }
  return results;
}

function formatGitMetadataContext(metadata: GitRepoMetadata[]): string {
  return metadata
    .map(
      (m) =>
        `- ${m.dirName}/: remote=${m.remoteUrl}, branch=${m.branch}, tag=${m.tag || "—"}, commit=${m.shortSha} (${m.fullSha}), date=${m.commitDate}, message=${m.subject}`
    )
    .join("\n");
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
      : type === "git_snapshot"
      ? { gitSnapshotContent: content }
      : { sddContent: content };
  await db
    .update(docGenerationJobs)
    .set(updateField)
    .where(eq(docGenerationJobs.id, jobId));
}

async function resolveJobActor(jobId: string): Promise<string> {
  const db = getDb();
  const job = await db
    .select({ userId: docGenerationJobs.userId })
    .from(docGenerationJobs)
    .where(eq(docGenerationJobs.id, jobId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!job?.userId) return "Orbit Docs";

  const user = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, job.userId))
    .limit(1)
    .then((rows) => rows[0]);

  return user?.name || user?.email || "Orbit Docs";
}

async function persistProductDoc(
  jobId: string,
  appId: string,
  type: GenerationProductDocType,
  content: string,
  actor: string,
  options?: { checkAdrCompliance?: boolean }
): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) return;

  await updateJobResult(jobId, type, content);

  const previous = await readProductDocForGeneration(appId, type, {
    excludeJobId: jobId,
  });
  if (previous?.trim() === trimmed) {
    return;
  }

  const db = getDb();
  await db.insert(docGenerationVersions).values({
    jobId,
    docType: type,
    content: trimmed,
    actor,
  });

  const appDocType = generationDocTypeToAppDocType(type);
  await saveAppProductDoc(appId, appDocType, trimmed, actor);

  if (options?.checkAdrCompliance !== false) {
    const violations = await checkAdrCompliance(appId, trimmed);
    if (violations.length > 0) {
      await db.insert(docGenerationDebugLogs).values({
        jobId,
        eventType: "adr_compliance_warning",
        eventData: JSON.stringify({
          docType: type,
          violationCount: violations.length,
          violations,
        }),
      });
    }
  }
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
  opts: { partialField?: DocType; flushMs?: number; cursorModel?: string } = {}
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

    return result;
  } finally {
    clearInterval(flushTimer);
    clearInterval(cancelPoll);
    await debugBuffer.dispose();
  }
}

interface RunAgentForDocOptions {
  partialField?: DocType;
  outputRelativePath: string;
  existingContent?: string | null;
  docType?: GeneratedDocType;
}

/**
 * Run the agent for document generation, prefer on-disk file output over chat text,
 * validate completeness, and retry once when output looks truncated.
 */
async function runAgentForDoc(
  agent: Agent,
  jobId: string,
  prompt: string,
  workdir: string,
  opts: RunAgentForDocOptions
): Promise<string> {
  const fileBefore = await readExistingDoc(workdir, opts.outputRelativePath, opts.docType);
  let lastPrompt = prompt;
  let lastContent = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const chatOutput = await runAgentAnalyze(agent, jobId, lastPrompt, workdir, {
      partialField: opts.partialField,
    });

    lastContent = await resolveAgentDocOutput(chatOutput, workdir, {
      outputRelativePath: opts.outputRelativePath,
      existingContent: opts.existingContent,
      fileContentBefore: fileBefore,
      docType: opts.docType,
    });

    const validation = validateGeneratedDocContent(lastContent, opts.existingContent);
    if (validation.valid) {
      return lastContent;
    }

    if (attempt === 0) {
      lastPrompt = buildDocFileRetryPrompt(
        opts.outputRelativePath,
        validation.reason ?? "incomplete output"
      );
      await updateJobLiveProgress(jobId, {
        progressMessage: "Retrying — previous output was incomplete…",
      });
      continue;
    }

    assertValidGeneratedDoc(lastContent, opts.existingContent);
  }

  return lastContent;
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
    prStatus: PrMergeStatus;
    mergeErrorMessage: string | null;
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
  autoMergeDocs: boolean;
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
      autoMergeDocs: r.autoMergeDocs ?? false,
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
        autoMergeDocs: false,
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

function resolveProductDocsRepo(repos: RepoRow[]): RepoRow {
  if (repos.length === 0) {
    throw new Error("No repositories configured for this app");
  }
  return repos[0];
}

function resolveSddDocPath(repo: RepoRow, repoType: SddRepoType): string {
  const filename = sddFilenameForRepoType(repoType, getRepoName(repo.repoUrl));
  if (repo.sddDocPath.includes("/")) {
    return repo.sddDocPath.replace(/[^/]+$/, filename);
  }
  return `docs/${filename}`;
}

/** Write a document back to a repo via a PR/MR when credentials are available. */
interface WriteBackResult {
  prUrl: string | null;
  prStatus: PrMergeStatus | null;
  mergeErrorMessage: string | null;
}

const MISSING_REPO_TOKEN_MESSAGE =
  "No repository access token — add one under App → Repositories to open a PR with this SDD.";

async function writeDocBack(
  repo: RepoRow,
  cloneDir: string,
  filePath: string,
  fileContent: string,
  ref: string | null,
  docLabel: string
): Promise<WriteBackResult> {
  if (!repo.accessToken) {
    return {
      prUrl: null,
      prStatus: null,
      mergeErrorMessage: MISSING_REPO_TOKEN_MESSAGE,
    };
  }

  const contentForRepo = await preferDiskDocOutput(cloneDir, filePath, fileContent, "sdd");
  const suffix = (ref || Date.now().toString()).replace(/[^a-zA-Z0-9._-]/g, "-");
  const slug = docLabel.toLowerCase().replace(/\s+/g, "-");
  const branchName = `orbit-docs/${slug}-update-${suffix}`;
  const refLabel = ref ? ` for ${ref}` : "";

  try {
    const prUrl = await openPullRequest({
      provider: repo.provider,
      hostUrl: repo.hostUrl,
      repoUrl: repo.repoUrl,
      token: repo.accessToken,
      cloneDir,
      baseBranch: repo.defaultBranch,
      filePath,
      fileContent: contentForRepo,
      branchName,
      commitMessage: `docs: update ${docLabel}${refLabel}`,
      prTitle: `Update ${docLabel}${refLabel}`,
      prBody:
        `This PR updates the ${docLabel} at \`${filePath}\`.\n\n` +
        `Generated automatically by Orbit Docs.`,
    });

    if (!prUrl) {
      return {
        prUrl: null,
        prStatus: null,
        mergeErrorMessage: "Pull request was created but no URL was returned.",
      };
    }

    if (!repo.autoMergeDocs) {
      return { prUrl, prStatus: "open", mergeErrorMessage: null };
    }

    const mergeResult = await autoMergePullRequest({
      provider: repo.provider,
      hostUrl: repo.hostUrl,
      repoUrl: repo.repoUrl,
      token: repo.accessToken,
      prUrl,
      baseBranch: repo.defaultBranch,
    });

    return {
      prUrl,
      prStatus: mergeResult.status,
      mergeErrorMessage: mergeResult.errorMessage ?? null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/no changes to commit/i.test(msg)) {
      return {
        prUrl: null,
        prStatus: null,
        mergeErrorMessage: "Repository SDD already matches the generated content — no PR needed.",
      };
    }
    return {
      prUrl: null,
      prStatus: null,
      mergeErrorMessage: msg,
    };
  }
}

/**
 * Product-scoped run: SRS + FSD + GIT-SNAPSHOT + SDD index are stored in the
 * app library (with version history). Only per-repository SDD files are written
 * back to git via PR/MR.
 */
export async function generateProductDocs(
  jobId: string,
  appId: string,
  onProgress: ProgressCallback,
  opts: { cursorModel?: string } = {}
): Promise<void> {
  const agent = createAgent({ model: opts.cursorModel });
  const baseDir = join(getRepoDir(), appId);
  const settings = await getDocGenerationSettings();

  const enabledSteps = [
    settings.srsEnabled,
    settings.fsdEnabled,
    settings.gitSnapshotEnabled,
    settings.sddIndexEnabled,
    settings.sddPerRepoEnabled,
  ].filter(Boolean).length;

  if (enabledSteps === 0) {
    throw new Error("All document types are disabled in Settings → Document Generation");
  }

  try {
    const repos = await loadAppRepos(appId);
    if (repos.length === 0) {
      throw new Error("No repositories configured for this app");
    }

    const actor = await resolveJobActor(jobId);

    let stepIndex = 0;
    const progressFor = (message: string, status: GenerationStatus) => {
      stepIndex += 1;
      const pct = Math.min(95, Math.round((stepIndex / (enabledSteps + 2)) * 100));
      return onProgress({ status, progressPct: pct, progressMessage: message });
    };

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
      await cloneOrPull(
        repo.repoUrl,
        dir,
        repo.provider,
        repo.accessToken,
        false,
        repo.hostUrl,
        repo.defaultBranch
      );
      cloneDirs[repo.repoUrl] = dir;
    }

    await onProgress({
      status: "analyzing",
      progressPct: 15,
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
    const gitMetadata = await collectGitMetadata(repos, cloneDirs);
    const gitContext = formatGitMetadataContext(gitMetadata);
    const productRepo = resolveProductDocsRepo(repos);
    const productDir = cloneDirs[productRepo.repoUrl];
    const srsDocPath = DEFAULT_DOC_PATHS.prdDocPath;
    const fsdDocPath = DEFAULT_DOC_PATHS.fsdDocPath;

    let srsContent = "";
    let fsdContent = "";

    if (settings.srsEnabled) {
      const existingSrs = await readProductDocForGeneration(appId, "srs", {
        excludeJobId: jobId,
        repoFallback: () => readExistingDoc(productDir, srsDocPath, "srs"),
      });
      const srsTemplate = await loadTemplate("srs");
      await progressFor(
        existingSrs
          ? "Updating SRS from app library..."
          : "Generating Software Requirements Specification (SRS)...",
        "generating_srs"
      );
      if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

      const srsPrompt = await withAdrConstraints(
        appId,
        existingSrs
          ? buildPrdUpdatePrompt(aggregateContext, baseDir, srsDocPath)
          : buildPrdCreatePrompt(srsTemplate, aggregateContext, baseDir, srsDocPath),
        { isUpdate: !!existingSrs }
      );

      srsContent = await runAgentForDoc(agent, jobId, srsPrompt, productDir, {
        partialField: "srs",
        outputRelativePath: srsDocPath,
        existingContent: existingSrs,
        docType: "srs",
      });
      await persistProductDoc(jobId, appId, "srs", srsContent, actor);
      await updateJobLiveProgress(jobId, { partialContent: null, currentActivity: null });
    }

    if (settings.fsdEnabled) {
      const existingFsd = await readProductDocForGeneration(appId, "fsd", {
        excludeJobId: jobId,
        repoFallback: () => readExistingDoc(productDir, fsdDocPath, "fsd"),
      });
      const fsdTemplate = await loadTemplate("fsd");
      await progressFor(
        existingFsd
          ? "Updating FSD from app library..."
          : "Generating Functional Specification Document (FSD)...",
        "generating_fsd"
      );
      if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

      const fsdPrompt = await withAdrConstraints(
        appId,
        existingFsd
          ? buildFsdUpdatePrompt(
              aggregateContext,
              baseDir,
              srsContent ? srsContent.substring(0, 2000) : "(SRS not generated — infer from codebases)",
              fsdDocPath
            )
          : buildFsdCreatePrompt(
              fsdTemplate,
              aggregateContext,
              baseDir,
              srsContent ? srsContent.substring(0, 2000) : "(SRS not generated — infer from codebases)",
              fsdDocPath
            ),
        { isUpdate: !!existingFsd }
      );

      fsdContent = await runAgentForDoc(agent, jobId, fsdPrompt, productDir, {
        partialField: "fsd",
        outputRelativePath: fsdDocPath,
        existingContent: existingFsd,
        docType: "fsd",
      });
      await persistProductDoc(jobId, appId, "fsd", fsdContent, actor);
      await updateJobLiveProgress(jobId, { partialContent: null, currentActivity: null });
    }

    let gitSnapshotContent = "";
    if (settings.gitSnapshotEnabled) {
      await progressFor("Generating Git Snapshot reference...", "generating_git_snapshot");
      if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

      const gitTemplate = await loadTemplate("git_snapshot");
      const existingGitSnapshot = await readProductDocForGeneration(appId, "git_snapshot", {
        excludeJobId: jobId,
        repoFallback: () =>
          readExistingDoc(productDir, GIT_SNAPSHOT_DOC_PATH, "srs"),
      });

      const gitPrompt = await withAdrConstraints(
        appId,
        `You are documenting a multi-repository product. Repositories are cloned under: ${baseDir}

Using git metadata collected below AND your tools to verify against each repo if needed, produce a GIT-SNAPSHOT.md reference document at \`${GIT_SNAPSHOT_DOC_PATH}\`.

Collected git metadata:
${gitContext}

Per-repository details:
${gitMetadata
  .map(
    (m) =>
      `- ${m.dirName}: path=${join(baseDir, m.dirName)}, remote=${m.remoteUrl}, branch=${m.branch}, tag=${m.tag || "none"}, short=${m.shortSha}, full=${m.fullSha}, date=${m.commitDate}, subject=${m.subject}`
  )
  .join("\n")}

Template:
${gitTemplate}

${buildDocFileOutputInstructions(GIT_SNAPSHOT_DOC_PATH)}

Instructions:
- Fill the snapshot table with accurate commit data for each repository.
- Map each SDD document filename to its codebase.`,
        { isUpdate: !!existingGitSnapshot }
      );

      gitSnapshotContent = await runAgentForDoc(agent, jobId, gitPrompt, productDir, {
        partialField: "git_snapshot",
        outputRelativePath: GIT_SNAPSHOT_DOC_PATH,
        existingContent: existingGitSnapshot,
      });
      await persistProductDoc(jobId, appId, "git_snapshot", gitSnapshotContent, actor, {
        checkAdrCompliance: false,
      });
      await updateJobLiveProgress(jobId, { partialContent: null, currentActivity: null });
    }

    let sddIndexContent = "";
    if (settings.sddIndexEnabled) {
      await progressFor("Generating SDD index document...", "generating_sdd_index");
      if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

      const sddIndexTemplate = await loadTemplate("sdd_index");
      const repoIndexLines = repos
        .map((repo) => {
          const dir = cloneDirs[repo.repoUrl];
          const repoType = detectRepoType(dir);
          const filename = sddFilenameForRepoType(repoType, getRepoName(repo.repoUrl));
          return `- ${repo.name} (${repoType}): ${filename}`;
        })
        .join("\n");

      const existingSddIndex = await readProductDocForGeneration(appId, "sdd_index", {
        excludeJobId: jobId,
        repoFallback: () => readExistingDoc(productDir, SDD_INDEX_DOC_PATH, "sdd"),
      });

      const sddIndexPrompt = await withAdrConstraints(
        appId,
        `You are an expert software architect documenting a multi-repository product under: ${baseDir}

Produce a product-wide SDD INDEX document (SDD.md) at \`${SDD_INDEX_DOC_PATH}\` that links to per-repository SDD files.

${aggregateContext}

Git snapshot:
${gitSnapshotContent ? gitSnapshotContent.substring(0, 1500) : gitContext}

Per-repository SDD files to link:
${repoIndexLines}

SRS excerpt:
${srsContent ? srsContent.substring(0, 1200) : "(not available)"}

Template:
${sddIndexTemplate}

${buildDocFileOutputInstructions(SDD_INDEX_DOC_PATH)}

Instructions:
- SDD.md is an index only — detailed design lives in per-repo SDD files.
- Fill in all {{placeholders}} with actual content.`,
        { isUpdate: !!existingSddIndex }
      );

      sddIndexContent = await runAgentForDoc(agent, jobId, sddIndexPrompt, productDir, {
        partialField: "sdd_index",
        outputRelativePath: SDD_INDEX_DOC_PATH,
        existingContent: existingSddIndex,
        docType: "sdd",
      });
      await persistProductDoc(jobId, appId, "sdd_index", sddIndexContent, actor);
      await updateJobLiveProgress(jobId, { partialContent: null, currentActivity: null });
    }

    if (settings.sddPerRepoEnabled) {
      await progressFor(
        "Generating System Design Documents per repository...",
        "generating_sdd"
      );

      for (const repo of repos) {
        if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

        const dir = cloneDirs[repo.repoUrl];
        const repoType = detectRepoType(dir);
        const sddTemplate = await loadTemplate(repoType === "generic" ? "backend" : repoType);
        const sddPath = resolveSddDocPath(repo, repoType);
        const resultId = await createRepoResult(jobId, repo.id, repo.repoUrl);
        await updateRepoResult(resultId, { status: "generating" });

        try {
          const structure = await getRepoStructure(dir);
          const keyFiles = await getKeyFileNames(dir);
          const repoContext = `Repository: ${repo.name} (${repo.repoUrl})\nType: ${repoType}\nLocal path: ${dir}\nKey files: ${keyFiles.join(", ") || "none"}\nStructure:\n${structure}`;
          const srsExcerpt = srsContent
            ? srsContent.substring(0, 1500)
            : "(SRS not generated)";
          const fsdExcerpt = fsdContent
            ? fsdContent.substring(0, 1500)
            : "(FSD not generated)";

          const existingSdd = await readExistingDoc(dir, sddPath, "sdd");
          const sddPrompt = await withAdrConstraints(
            appId,
            existingSdd
              ? buildSddUpdatePrompt(
                  dir,
                  repo.name,
                  repoContext,
                  srsExcerpt,
                  fsdExcerpt,
                  sddPath
                )
              : buildSddCreatePrompt(
                  sddTemplate,
                  dir,
                  repo.name,
                  repoContext,
                  srsExcerpt,
                  fsdExcerpt,
                  sddPath
                ),
            { isUpdate: !!existingSdd }
          );

          const agentSddContent = await runAgentForDoc(agent, jobId, sddPrompt, dir, {
            partialField: "sdd",
            outputRelativePath: sddPath,
            existingContent: existingSdd,
            docType: "sdd",
          });
          const sddContent = await preferDiskDocOutput(dir, sddPath, agentSddContent, "sdd");
          const ref = await getRepoRef(dir);
          await updateRepoResult(resultId, {
            sddContent,
            repoRef: ref || undefined,
            status: "writing_back",
          });

          await onProgress({
            status: "writing_back",
            progressPct: 92,
            progressMessage: repo.accessToken
              ? repo.autoMergeDocs
                ? `Opening and merging PR for ${repo.name}...`
                : `Opening PR for ${repo.name}...`
              : `Saving SDD preview for ${repo.name} (no repo token)...`,
          });
          const writeBack = await writeDocBack(
            repo,
            dir,
            sddPath,
            sddContent,
            ref,
            "System Design Document"
          );

          await updateRepoResult(resultId, {
            status: "completed",
            prUrl: writeBack.prUrl || undefined,
            prStatus: writeBack.prStatus || undefined,
            mergeErrorMessage: writeBack.mergeErrorMessage,
          });

          if (repo.id && ref && writeBack.prUrl) {
            await updateRepoLastProcessedRef(repo.id, ref);
          }
        } catch (repoErr) {
          const msg =
            repoErr instanceof Error ? repoErr.message : "SDD generation failed";
          await updateRepoResult(resultId, {
            status: "failed",
            errorMessage: msg,
          });
        }
      }
    }

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
      autoMergeDocs: repoRow.autoMergeDocs ?? false,
      lastProcessedRef: repoRow.lastProcessedRef,
    };

    const dir = join(getRepoDir(), repoRow.appId, getRepoName(repo.repoUrl));
    const resultId = await createRepoResult(jobId, repo.id, repo.repoUrl);

    // Step 1: Clone/pull with full history (needed to diff between tags)
    await onProgress({
      status: "cloning",
      progressPct: 10,
      progressMessage: `Updating ${repo.name}...`,
    });
    await ensureDir(join(getRepoDir(), repoRow.appId));
    await cloneOrPull(
      repo.repoUrl,
      dir,
      repo.provider,
      repo.accessToken,
      true,
      repo.hostUrl,
      repo.defaultBranch
    );

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

    const repoType = detectRepoType(dir);
    const sddPath = resolveSddDocPath(repo, repoType);
    const existingSdd = await readExistingDoc(dir, sddPath, "sdd");
    const sddTemplate = await loadTemplate(repoType === "generic" ? "backend" : repoType);

    // Step 3: Generate / update SDD
    await onProgress({
      status: "generating_sdd",
      progressPct: 55,
      progressMessage: existingSdd
        ? `Updating existing SDD at ${sddPath}...`
        : "Generating System Design Document (first run)...",
    });

    let sddContent: string;
    if (existingSdd && changedFiles.length > 0) {
      const prompt = await withAdrConstraints(
        repoRow.appId,
        buildSddDiffUpdatePrompt(
          repo.name,
          dir,
          newTag,
          changedFiles,
          patch,
          sddPath
        ),
        { isUpdate: true }
      );
      sddContent = await runAgentForDoc(agent, jobId, prompt, dir, {
        partialField: "sdd",
        outputRelativePath: sddPath,
        existingContent: existingSdd,
        docType: "sdd",
      });
    } else if (existingSdd) {
      const structure = await getRepoStructure(dir);
      const keyFiles = await getKeyFileNames(dir);
      const repoContext = `Repository: ${repo.name} (${repo.repoUrl})\nType: ${repoType}\nLocal path: ${dir}\nKey files: ${keyFiles.join(", ") || "none"}\nStructure:\n${structure}`;
      const prompt = await withAdrConstraints(
        repoRow.appId,
        buildSddUpdatePrompt(
          dir,
          repo.name,
          repoContext,
          "(not available for repo-scoped run)",
          "(not available for repo-scoped run)",
          sddPath
        ),
        { isUpdate: true }
      );
      sddContent = await runAgentForDoc(agent, jobId, prompt, dir, {
        partialField: "sdd",
        outputRelativePath: sddPath,
        existingContent: existingSdd,
        docType: "sdd",
      });
    } else {
      const structure = await getRepoStructure(dir);
      const keyFiles = await getKeyFileNames(dir);
      const repoContext = `Repository: ${repo.name} (${repo.repoUrl})\nType: ${repoType}\nLocal path: ${dir}\nKey files: ${keyFiles.join(", ") || "none"}\nStructure:\n${structure}`;
      const prompt = await withAdrConstraints(
        repoRow.appId,
        buildSddCreatePrompt(
          sddTemplate,
          dir,
          repo.name,
          repoContext,
          "(not available for repo-scoped run)",
          "(not available for repo-scoped run)",
          sddPath
        ),
        { isUpdate: false }
      );
      sddContent = await runAgentForDoc(agent, jobId, prompt, dir, {
        partialField: "sdd",
        outputRelativePath: sddPath,
        existingContent: null,
        docType: "sdd",
      });
    }

    sddContent = await preferDiskDocOutput(dir, sddPath, sddContent, "sdd");
    await updateRepoResult(resultId, {
      sddContent,
      status: "writing_back",
    });
    await updateJobResult(jobId, "sdd", sddContent);

    await onProgress({
      status: "writing_back",
      progressPct: 85,
      progressMessage: repo.accessToken
        ? repo.autoMergeDocs
          ? `Opening and merging PR for ${repo.name}...`
          : `Opening PR for ${repo.name}...`
        : `SDD ready for ${repo.name} (no repo token)...`,
    });
    const writeBack = await writeDocBack(
      repo,
      dir,
      sddPath,
      sddContent,
      newTag,
      "System Design Document"
    );

    await updateRepoResult(resultId, {
      status: "completed",
      prUrl: writeBack.prUrl || undefined,
      prStatus: writeBack.prStatus || undefined,
      mergeErrorMessage: writeBack.mergeErrorMessage,
    });
    if (writeBack.prUrl) {
      await updateRepoLastProcessedRef(repoId, newTag);
    }

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

/**
 * Wiki-scoped run: analyze repo(s), plan multi-page wiki, generate each page,
 * and persist as a doc site in Orbit Docs (draft). No git write-back.
 */
export async function generateWikiDocs(
  jobId: string,
  appId: string,
  onProgress: ProgressCallback,
  opts: { cursorModel?: string } = {},
): Promise<void> {
  const agent = createAgent({ model: opts.cursorModel });
  const baseDir = join(getRepoDir(), appId);
  const db = getDb();

  try {
    const repos = await loadAppRepos(appId);
    if (repos.length === 0) {
      throw new Error("No repositories configured for this app");
    }

    const appRow = await db
      .select({ name: apps.name })
      .from(apps)
      .where(eq(apps.id, appId))
      .limit(1)
      .then((r) => r[0]);
    const appName = appRow?.name || "Product";

    const actor = await resolveJobActor(jobId);

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
      await cloneOrPull(
        repo.repoUrl,
        dir,
        repo.provider,
        repo.accessToken,
        false,
        repo.hostUrl,
        repo.defaultBranch,
      );
      cloneDirs[repo.repoUrl] = dir;
    }

    await onProgress({
      status: "analyzing",
      progressPct: 15,
      progressMessage: "Analyzing repositories for wiki outline...",
    });
    if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

    const repoSummaries: string[] = [];
    for (const repo of repos) {
      const dir = cloneDirs[repo.repoUrl];
      const structure = await getRepoStructure(dir);
      const keyFiles = await getKeyFileNames(dir);
      repoSummaries.push(
        `### Repository: ${repo.name} (${repo.repoUrl})\nLocal path: ${dir}\nKey files: ${keyFiles.join(", ") || "none"}\nStructure:\n${structure}`,
      );
    }
    const aggregateContext = `This product is composed of ${repos.length} repositories. Analyze ALL of them.\n\n${repoSummaries.join("\n\n")}`;

    await onProgress({
      status: "generating_wiki_outline",
      progressPct: 25,
      progressMessage: "Planning wiki pages...",
    });
    if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

    const outlinePrompt = await withAdrConstraints(
      appId,
      buildWikiOutlinePrompt(aggregateContext, baseDir, appName),
    );
    const outlineRaw = await runAgentAnalyze(agent, jobId, outlinePrompt, baseDir, {
      partialField: "sdd",
    });
    const plan = parseWikiOutlineJson(outlineRaw);
    await updateJobLiveProgress(jobId, { partialContent: null, currentActivity: null });

    const overviewTemplate = await loadWikiTemplate("overview");
    const pageTemplate = await loadWikiTemplate("page");
    const wikiPages: WikiPageContent[] = [];
    const pageCount = plan.pages.length;

    for (let i = 0; i < plan.pages.length; i++) {
      const pagePlan = plan.pages[i];
      const isOverview = pagePlan.slug === "1-overview";
      const pct = 30 + Math.round(((i + 1) / pageCount) * 60);

      await onProgress({
        status: "generating_wiki_pages",
        progressPct: pct,
        progressMessage: `Generating wiki page: ${pagePlan.title} (${i + 1}/${pageCount})...`,
      });
      if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

      const template = isOverview ? overviewTemplate : pageTemplate;
      const pagePrompt = await withAdrConstraints(
        appId,
        buildWikiPagePrompt(
          template,
          pagePlan,
          plan.siteSlug,
          plan.pages,
          aggregateContext,
          baseDir,
          isOverview,
        ),
      );

      const content = await runAgentAnalyze(agent, jobId, pagePrompt, baseDir, {
        partialField: "sdd",
      });
      const title = planPageTitle(pagePlan);
      wikiPages.push({
        slug: pagePlan.slug,
        title,
        content: sanitizeWikiMarkdown(content, title),
        sortOrder: wikiPageSortOrder(pagePlan.slug, i),
      });
      await updateJobLiveProgress(jobId, { partialContent: null, currentActivity: null });
    }

    const result = await createOrUpdateWikiSite(appId, plan, wikiPages, actor);

    if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");
    await updateJobCompletion(jobId, true);
    await onProgress({
      status: "completed",
      progressPct: 100,
      progressMessage: `Wiki site ready at /wiki/${result.siteSlug}/1-overview`,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error during wiki generation";
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

export { updateJobProgress };
