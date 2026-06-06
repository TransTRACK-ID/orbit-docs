import { exec } from "child_process";
import { promisify } from "util";
import { readFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { getDb } from "~/server/database";
import { docGenerationJobs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { createOpencodeAgent } from "./opencode-agent";

const execAsync = promisify(exec);

const REPO_DIR = join(process.cwd(), "orbit-docs-repositories");

async function ensureRepoDir(): Promise<void> {
  if (!existsSync(REPO_DIR)) {
    await mkdir(REPO_DIR, { recursive: true });
  }
}

export type DocType = "srs" | "fsd" | "sdd";
export type GenerationStatus =
  | "cloning"
  | "analyzing"
  | "generating_srs"
  | "generating_fsd"
  | "generating_sdd"
  | "completed"
  | "failed"
  | "cancelled";

interface ProgressUpdate {
  status: GenerationStatus;
  progressPct: number;
  progressMessage: string;
}

type ProgressCallback = (update: ProgressUpdate) => void | Promise<void>;

const STATUS_PROGRESS: Record<GenerationStatus, number> = {
  cloning: 5,
  analyzing: 20,
  generating_srs: 40,
  generating_fsd: 60,
  generating_sdd: 80,
  completed: 100,
  failed: 0,
};

async function loadTemplate(type: DocType): Promise<string> {
  const templatePath = join(process.cwd(), "templates", `${type}_template.md`);
  return readFile(templatePath, "utf-8");
}

async function cloneOrPullRepo(repoUrl: string, cloneDir: string): Promise<void> {
  await ensureRepoDir();
  const exists = existsSync(join(cloneDir, ".git"));
  if (exists) {
    // Pull existing repo
    const { stderr } = await execAsync(`git -C "${cloneDir}" pull`, {
      timeout: 120000,
    });
    if (stderr && stderr.includes("error")) {
      throw new Error(`Git pull failed: ${stderr}`);
    }
  } else {
    // Clone new repo
    const { stderr } = await execAsync(
      `git clone --depth 1 "${repoUrl}" "${cloneDir}"`,
      { timeout: 120000 }
    );
    if (stderr && stderr.includes("error")) {
      throw new Error(`Git clone failed: ${stderr}`);
    }
  }
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

async function getKeyFiles(repoDir: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const keyFiles = [
    "README.md",
    "package.json",
    "nuxt.config.ts",
    "next.config.js",
    "tsconfig.json",
    "docker-compose.yml",
    "Dockerfile",
    ".env.example",
    ".env.local.example",
  ];

  for (const file of keyFiles) {
    try {
      const content = await readFile(join(repoDir, file), "utf-8");
      files[file] = content.substring(0, 10000); // Limit size
    } catch {
      // File doesn't exist, skip
    }
  }

  return files;
}

async function getRouteFiles(repoDir: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      `find "${repoDir}" -type f \\( -path '*/pages/*' -o -path '*/app/*' -o -path '*/routes/*' -o -path '*/controllers/*' -o -path '*/server/api/*' \\) -not -path '*/node_modules/*' | head -50`,
      { timeout: 30000 }
    );
    return stdout.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

async function getSchemaFiles(repoDir: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      `find "${repoDir}" -type f \\( -path '*/schema/*' -o -path '*/prisma/*' -o -path '*/models/*' -o -path '*/migrations/*' \\) -name '*.ts' -o -name '*.js' -o -name '*.prisma' -o -name '*.sql' | head -30`,
      { timeout: 30000 }
    );
    return stdout.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

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

function getRepoName(repoUrl: string): string {
  const clean = repoUrl.replace(/\.git$/, "");
  const parts = clean.split("/");
  return parts[parts.length - 1] || "repo";
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

export async function generateDocs(
  jobId: string,
  repoUrl: string,
  onProgress: ProgressCallback
): Promise<void> {
  const repoName = getRepoName(repoUrl);
  const cloneDir = join(REPO_DIR, repoName);
  const agent = createOpencodeAgent();

  try {
    // Step 1: Clone or pull repository
    await onProgress({
      status: "cloning",
      progressPct: STATUS_PROGRESS.cloning,
      progressMessage: "Cloning or pulling repository...",
    });
    if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");
    await cloneOrPullRepo(repoUrl, cloneDir);

    // Step 2: Analyze repository
    await onProgress({
      status: "analyzing",
      progressPct: STATUS_PROGRESS.analyzing,
      progressMessage: "Analyzing codebase structure...",
    });
    if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

    const structure = await getRepoStructure(cloneDir);
    const keyFiles = await getKeyFiles(cloneDir);
    const routeFiles = await getRouteFiles(cloneDir);
    const schemaFiles = await getSchemaFiles(cloneDir);

    // Read a few route files for analysis
    const routeContents: Record<string, string> = {};
    for (const route of routeFiles.slice(0, 10)) {
      try {
        const content = await readFile(route, "utf-8");
        routeContents[route] = content.substring(0, 5000);
      } catch {
        // Skip unreadable files
      }
    }

    // Read a few schema files
    const schemaContents: Record<string, string> = {};
    for (const schema of schemaFiles.slice(0, 5)) {
      try {
        const content = await readFile(schema, "utf-8");
        schemaContents[schema] = content.substring(0, 5000);
      } catch {
        // Skip unreadable files
      }
    }

    // Analysis context for reference hints (Opencode will do the deep analysis itself via its tools)
    const analysisContext = `
Repository URL: ${repoUrl}
Local clone path: ${cloneDir}

File Structure (top-level, for reference):
${structure}

Key configuration files found:
${Object.keys(keyFiles).join(", ") || "none"}

Route/controller files found:
${routeFiles.slice(0, 20).join("\n") || "none"}

Schema files found:
${schemaFiles.slice(0, 10).join("\n") || "none"}
`;

    // Step 3: Generate SRS
    await onProgress({
      status: "generating_srs",
      progressPct: STATUS_PROGRESS.generating_srs,
      progressMessage: "Generating Software Requirements Specification...",
    });
    if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

    const srsTemplate = await loadTemplate("srs");
    const srsPrompt = `You are an expert software architect. You have been given access to a cloned Git repository at the path: ${cloneDir}

Your task is to deeply analyze the codebase using your available tools (read files, run bash commands like find, cat, grep, etc.) and then generate a complete Software Requirements Specification (SRS) document.

Here is a structural overview to help you get started:
${analysisContext}

Use the following SRS template structure and fill in ALL sections with real content from the codebase:

${srsTemplate}

Instructions:
- Use your file read and bash tools to explore the repository thoroughly before writing.
- Read the README, package.json, source files, API routes, schemas, and any relevant docs.
- Fill in all {{placeholders}} with actual content derived from the codebase.
- Be thorough, specific, and accurate. Do NOT use placeholder text.
- Output ONLY the completed SRS markdown document.`;

    const srsContent = await agent.analyze(srsPrompt, cloneDir);
    await updateJobResult(jobId, "srs", srsContent);

    // Step 4: Generate FSD
    await onProgress({
      status: "generating_fsd",
      progressPct: STATUS_PROGRESS.generating_fsd,
      progressMessage: "Generating Functional Specification Document...",
    });
    if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

    const fsdTemplate = await loadTemplate("fsd");
    const fsdPrompt = `You are an expert software architect. You have been given access to a cloned Git repository at the path: ${cloneDir}

Your task is to deeply analyze the codebase using your available tools (read files, run bash commands like find, cat, grep, etc.) and then generate a complete Functional Specification Document (FSD).

Here is a structural overview to help you get started:
${analysisContext}

A Software Requirements Specification was already generated (for reference):
${srsContent.substring(0, 2000)}

Use the following FSD template structure and fill in ALL sections with real content from the codebase:

${fsdTemplate}

Instructions:
- Use your file read and bash tools to explore UI components, pages, API routes, and user flows.
- Focus on user workflows, UI behavior, and functional requirements.
- Fill in all {{placeholders}} with actual content derived from the codebase.
- Be thorough, specific, and accurate. Do NOT use placeholder text.
- Output ONLY the completed FSD markdown document.`;

    const fsdContent = await agent.analyze(fsdPrompt, cloneDir);
    await updateJobResult(jobId, "fsd", fsdContent);

    // Step 5: Generate SDD
    await onProgress({
      status: "generating_sdd",
      progressPct: STATUS_PROGRESS.generating_sdd,
      progressMessage: "Generating System Design Document...",
    });
    if (await isJobCancelled(jobId)) throw new Error("Generation cancelled");

    const sddTemplate = await loadTemplate("sdd");
    const sddPrompt = `You are an expert software architect. You have been given access to a cloned Git repository at the path: ${cloneDir}

Your task is to deeply analyze the codebase using your available tools (read files, run bash commands like find, cat, grep, etc.) and then generate a complete System Design Document (SDD).

Here is a structural overview to help you get started:
${analysisContext}

Previously generated SRS (for reference):
${srsContent.substring(0, 1500)}

Previously generated FSD (for reference):
${fsdContent.substring(0, 1500)}

Use the following SDD template structure and fill in ALL sections with real content from the codebase:

${sddTemplate}

Instructions:
- Use your file read and bash tools to explore architecture, data models, infrastructure files (Dockerfile, docker-compose), and deployment configs.
- Focus on architecture, component design, data storage, and deployment.
- Fill in all {{placeholders}} with actual content derived from the codebase.
- Be thorough, specific, and accurate. Do NOT use placeholder text.
- Output ONLY the completed SDD markdown document.`;

    const sddContent = await agent.analyze(sddPrompt, cloneDir);
    await updateJobResult(jobId, "sdd", sddContent);

    // Step 6: Complete
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
    
    // If cancelled, don't overwrite the cancelled status
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
  } finally {
    // Repositories are kept in orbit-docs-repositories for reuse
  }
}

export { updateJobProgress };
