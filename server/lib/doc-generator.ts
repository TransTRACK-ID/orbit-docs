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
  appRepositories,
  apps,
} from "~/server/database/schema";
import { eq, and, desc } from "drizzle-orm";
import { createOpencodeAgent } from "./opencode-agent";
import {
  cloneOrPull,
  diffSinceRef,
  openPullRequest,
  parseRepo,
  type GitProvider,
} from "./git-provider";

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

function buildSddPrompt(
  template: string,
  cloneDir: string,
  repoName: string,
  analysisContext: string,
  prdExcerpt: string,
  fsdExcerpt: string
): string {
  return `You are an expert software architect. You have been given access to a cloned Git repository "${repoName}" at the path: ${cloneDir}

Your task is to deeply analyze this repository using your available tools (read files, run bash commands like find, cat, grep, etc.) and then generate a complete System Design Document (SDD) for THIS repository specifically.

Structural overview:
${analysisContext}

Product-level PRD (for reference):
${prdExcerpt}

Product-level FSD (for reference):
${fsdExcerpt}

Use the following SDD template structure and fill in ALL sections with real content from this repository's codebase:

${template}

Instructions:
- Explore the repository thoroughly (architecture, data models, infra files, deployment configs) before writing.
- Fill in all {{placeholders}} with actual content derived from the codebase.
- Be thorough, specific, and accurate. Do NOT use placeholder text.
- Output ONLY the completed SDD markdown document.`;
}

/** Write SDD back to a repo via a PR/MR when credentials are available. */
async function writeSddBack(
  repo: RepoRow,
  cloneDir: string,
  sddContent: string,
  ref: string | null
): Promise<string | null> {
  if (!repo.accessToken) return null;

  const suffix = (ref || Date.now().toString()).replace(/[^a-zA-Z0-9._-]/g, "-");
  const branchName = `orbit-docs/sdd-update-${suffix}`;
  const refLabel = ref ? ` for ${ref}` : "";

  return await openPullRequest({
    provider: repo.provider,
    repoUrl: repo.repoUrl,
    token: repo.accessToken,
    cloneDir,
    baseBranch: repo.defaultBranch,
    filePath: repo.sddDocPath,
    fileContent: sddContent,
    branchName,
    commitMessage: `docs: update SDD${refLabel}`,
    prTitle: `Update System Design Document${refLabel}`,
    prBody:
      `This PR updates the System Design Document at \`${repo.sddDocPath}\`.\n\n` +
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
  onProgress: ProgressCallback
): Promise<void> {
  const agent = createOpencodeAgent();
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
      await cloneOrPull(repo.repoUrl, dir, repo.provider, repo.accessToken);
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

    // Step 3: PRD (stored internally as srs)
    await onProgress({
      status: "generating_srs",
      progressPct: 40,
      progressMessage: "Generating Product Requirements Document...",
    });
    if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

    const prdTemplate = await loadTemplate("srs");
    const prdPrompt = `You are an expert software architect. You have been given access to multiple cloned Git repositories that together make up a single product. The repositories live under: ${baseDir}

Analyze ALL repositories using your tools (read files, bash: find, cat, grep) and produce a single, product-wide Product Requirements Document (PRD) that covers the whole product across its repositories.

${aggregateContext}

Use the following template structure and fill in ALL sections with real content derived from the codebases:

${prdTemplate}

Instructions:
- Treat the repositories as one product; describe product-level requirements, not per-repo internals.
- Fill in all {{placeholders}} with actual content. Do NOT use placeholder text.
- Output ONLY the completed markdown document.`;

    const prdContent = await agent.analyze(prdPrompt, baseDir);
    await updateJobResult(jobId, "srs", prdContent);

    // Step 4: FSD (product-level)
    await onProgress({
      status: "generating_fsd",
      progressPct: 60,
      progressMessage: "Generating Functional Specification Document...",
    });
    if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

    const fsdTemplate = await loadTemplate("fsd");
    const fsdPrompt = `You are an expert software architect with access to multiple cloned repositories that form one product under: ${baseDir}

Analyze ALL repositories and produce a single, product-wide Functional Specification Document (FSD).

${aggregateContext}

Product PRD (for reference):
${prdContent.substring(0, 2000)}

Use the following template structure and fill in ALL sections with real content:

${fsdTemplate}

Instructions:
- Focus on cross-repository user workflows, UI behavior, and functional requirements at the product level.
- Fill in all {{placeholders}} with actual content. Do NOT use placeholder text.
- Output ONLY the completed markdown document.`;

    const fsdContent = await agent.analyze(fsdPrompt, baseDir);
    await updateJobResult(jobId, "fsd", fsdContent);

    // Step 5: Per-repo SDD + write-back
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

        const sddPrompt = buildSddPrompt(
          sddTemplate,
          dir,
          repo.name,
          repoContext,
          prdContent.substring(0, 1500),
          fsdContent.substring(0, 1500)
        );

        const sddContent = await agent.analyze(sddPrompt, dir);
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
          prUrl = await writeSddBack(repo, dir, sddContent, ref);
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
  onProgress: ProgressCallback
): Promise<void> {
  const db = getDb();
  const agent = createOpencodeAgent();

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
    await cloneOrPull(repo.repoUrl, dir, repo.provider, repo.accessToken, true);

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

    // Find the most recent prior SDD for this repo to update incrementally
    const priorResult = await db
      .select()
      .from(docGenerationRepoResults)
      .where(
        and(
          eq(docGenerationRepoResults.repoId, repoId),
          eq(docGenerationRepoResults.status, "completed")
        )
      )
      .orderBy(desc(docGenerationRepoResults.createdAt))
      .limit(1)
      .then((rows) => rows[0]);

    const priorSdd = priorResult?.sddContent || null;
    const sddTemplate = await loadTemplate("sdd");

    // Step 3: Generate / update SDD
    await onProgress({
      status: "generating_sdd",
      progressPct: 55,
      progressMessage: "Updating System Design Document...",
    });

    let sddContent: string;
    if (priorSdd && changedFiles.length > 0) {
      // Token-efficient incremental update: feed only the diff + existing SDD
      const prompt = `You are an expert software architect maintaining the System Design Document (SDD) for the repository "${repo.name}" located at ${dir}.

A new release "${newTag}" was created. Below is the EXISTING SDD followed by the code changes since the last documented version. Update the SDD so it accurately reflects the changes. Keep sections that are unaffected unchanged. Only read additional files from ${dir} if strictly necessary to understand a change.

Changed files (${changedFiles.length}):
${changedFiles.slice(0, 100).join("\n")}

Code diff:
\`\`\`diff
${patch}
\`\`\`

EXISTING SDD:
${priorSdd}

Instructions:
- Output the COMPLETE updated SDD markdown document (not just the changed parts).
- Preserve the existing structure and headings.
- Do NOT use placeholder text.
- Output ONLY the markdown document.`;
      sddContent = await agent.analyze(prompt, dir);
    } else {
      // No prior SDD or no usable diff — do a full generation
      const structure = await getRepoStructure(dir);
      const keyFiles = await getKeyFileNames(dir);
      const repoContext = `Repository: ${repo.name} (${repo.repoUrl})\nLocal path: ${dir}\nKey files: ${keyFiles.join(", ") || "none"}\nStructure:\n${structure}`;
      const prompt = buildSddPrompt(
        sddTemplate,
        dir,
        repo.name,
        repoContext,
        "(not available for repo-scoped run)",
        "(not available for repo-scoped run)"
      );
      sddContent = await agent.analyze(prompt, dir);
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
      prUrl = await writeSddBack(repo, dir, sddContent, newTag);
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
