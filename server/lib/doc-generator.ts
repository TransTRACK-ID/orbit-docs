import { exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { join } from "path";
import { getDb } from "~/server/database";
import { docGenerationJobs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { createOpencodeAgent } from "./opencode-agent";

const execAsync = promisify(exec);

export type DocType = "srs" | "fsd" | "sdd";
export type GenerationStatus =
  | "cloning"
  | "analyzing"
  | "generating_srs"
  | "generating_fsd"
  | "generating_sdd"
  | "completed"
  | "failed";

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

async function cloneRepo(repoUrl: string, cloneDir: string): Promise<void> {
  const { stderr } = await execAsync(
    `git clone --depth 1 "${repoUrl}" "${cloneDir}"`,
    { timeout: 120000 }
  );
  if (stderr && stderr.includes("error")) {
    throw new Error(`Git clone failed: ${stderr}`);
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

export async function generateDocs(
  jobId: string,
  repoUrl: string,
  onProgress: ProgressCallback
): Promise<void> {
  const cloneDir = `/tmp/orbit-docs-${jobId}`;
  const agent = createOpencodeAgent();

  try {
    // Step 1: Clone repository
    await onProgress({
      status: "cloning",
      progressPct: STATUS_PROGRESS.cloning,
      progressMessage: "Cloning repository...",
    });
    await cloneRepo(repoUrl, cloneDir);

    // Step 2: Analyze repository
    await onProgress({
      status: "analyzing",
      progressPct: STATUS_PROGRESS.analyzing,
      progressMessage: "Analyzing codebase structure...",
    });

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

    const analysisContext = `
Repository URL: ${repoUrl}

File Structure:
${structure}

Key Files:
${Object.entries(keyFiles)
  .map(([name, content]) => `--- ${name} ---\n${content.substring(0, 2000)}`)
  .join("\n\n")}

Route/Controller Files:
${Object.entries(routeContents)
  .map(([name, content]) => `--- ${name} ---\n${content.substring(0, 2000)}`)
  .join("\n\n")}

Schema Files:
${Object.entries(schemaContents)
  .map(([name, content]) => `--- ${name} ---\n${content.substring(0, 2000)}`)
  .join("\n\n")}
`;

    // Step 3: Generate SRS
    await onProgress({
      status: "generating_srs",
      progressPct: STATUS_PROGRESS.generating_srs,
      progressMessage: "Generating Software Requirements Specification...",
    });

    const srsTemplate = await loadTemplate("srs");
    const srsPrompt = `Based on the following codebase analysis, generate a Software Requirements Specification (SRS) document.

Follow this template structure and fill in all sections:

${srsTemplate}

Analysis Context:
${analysisContext}

Generate the complete SRS document in markdown format. Fill in all {{placeholders}} with actual content derived from the codebase analysis. Be thorough and specific.`;

    const srsContent = await agent.analyze(srsPrompt);
    await updateJobResult(jobId, "srs", srsContent);

    // Step 4: Generate FSD
    await onProgress({
      status: "generating_fsd",
      progressPct: STATUS_PROGRESS.generating_fsd,
      progressMessage: "Generating Functional Specification Document...",
    });

    const fsdTemplate = await loadTemplate("fsd");
    const fsdPrompt = `Based on the following codebase analysis, generate a Functional Specification Document (FSD).

Follow this template structure and fill in all sections:

${fsdTemplate}

Analysis Context:
${analysisContext}

Generated SRS (for reference):
${srsContent.substring(0, 3000)}

Generate the complete FSD document in markdown format. Fill in all {{placeholders}} with actual content derived from the codebase analysis. Focus on user workflows, UI behavior, and functional requirements.`;

    const fsdContent = await agent.analyze(fsdPrompt);
    await updateJobResult(jobId, "fsd", fsdContent);

    // Step 5: Generate SDD
    await onProgress({
      status: "generating_sdd",
      progressPct: STATUS_PROGRESS.generating_sdd,
      progressMessage: "Generating System Design Document...",
    });

    const sddTemplate = await loadTemplate("sdd");
    const sddPrompt = `Based on the following codebase analysis, generate a System Design Document (SDD).

Follow this template structure and fill in all sections:

${sddTemplate}

Analysis Context:
${analysisContext}

Generated SRS (for reference):
${srsContent.substring(0, 2000)}

Generated FSD (for reference):
${fsdContent.substring(0, 2000)}

Generate the complete SDD document in markdown format. Fill in all {{placeholders}} with actual content derived from the codebase analysis. Focus on architecture, component design, data storage, and deployment.`;

    const sddContent = await agent.analyze(sddPrompt);
    await updateJobResult(jobId, "sdd", sddContent);

    // Step 6: Complete
    await updateJobCompletion(jobId, true);
    await onProgress({
      status: "completed",
      progressPct: 100,
      progressMessage: "Generation completed successfully",
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
  } finally {
    // Cleanup cloned repo
    try {
      await execAsync(`rm -rf "${cloneDir}"`, { timeout: 30000 });
    } catch {
      // Ignore cleanup errors
    }
  }
}

export { updateJobProgress };
