import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { stripGeneratedDocArtifacts } from "./generated-doc";
import type { GeneratedDocType } from "./generated-doc";

/**
 * Read an existing document from a cloned repository.
 *
 * @param cloneDir - Root of the cloned repository
 * @param relativePath - Path relative to repo root (e.g. "docs/PRD.md")
 * @param docType - Optional doc type for artifact stripping
 * @returns The trimmed file content, or `null` if missing/empty/read-error
 */
export async function readExistingDoc(
  cloneDir: string,
  relativePath: string,
  docType?: GeneratedDocType
): Promise<string | null> {
  const absPath = join(cloneDir, relativePath);

  if (!existsSync(absPath)) {
    return null;
  }

  try {
    let content = await readFile(absPath, "utf-8");
    // Strip BOM
    content = content.replace(/^\uFEFF/, "").trim();

    if (!content) {
      return null;
    }

    if (docType) {
      content = stripGeneratedDocArtifacts(content, docType);
    }

    return content;
  } catch {
    return null;
  }
}
