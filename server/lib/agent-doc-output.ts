import { readExistingDoc } from "./existing-doc";
import { stripGeneratedDocArtifacts, type GeneratedDocType } from "./generated-doc";
import {
  looksTruncatedDocOutput,
  looksLikeRawAgentOutput,
  validateGeneratedDocContent,
} from "./generated-doc-validation";
import {
  mergeDocSectionUpdates,
  appendRevisionHistoryRow,
  parseDocSectionUpdatePayload,
  tryBuildFullDocFromPayload,
  buildFullDocFromAllSections,
  extractFullMarkdownFromAgentJson,
} from "./doc-section-merge";
import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";

export { validateGeneratedDocContent, looksLikeRawAgentOutput };

const DOC_WRITTEN_RE = /^DOC_WRITTEN:\s*(.+)$/m;

export interface ResolveAgentDocOutputOptions {
  outputRelativePath?: string;
  existingContent?: string | null;
  /** File content before the agent run — used to detect write-tool output. */
  fileContentBefore?: string | null;
  docType?: GeneratedDocType;
}

/**
 * Try to extract a readable markdown document from agent chat output that
 * contains JSON section-update payloads. Handles both single-H1 payloads
 * (via extractFullMarkdownFromAgentJson) and multi-section payloads (via
 * buildFullDocFromAllSections). Returns null if no JSON is found or parsing
 * fails.
 */
function extractMarkdownFromAgentJson(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Single H1 section → full document.
  const single = extractFullMarkdownFromAgentJson(trimmed);
  if (single) return single;

  // Multi-section payload → build a standalone doc from all sections.
  try {
    const payload = parseDocSectionUpdatePayload(trimmed);
    if (payload.sections.length > 0) {
      return buildFullDocFromAllSections(payload);
    }
  } catch {
    // Not valid JSON or no sections — fall through.
  }

  return null;
}

/**
 * Prefer on-disk file content when the agent wrote via tools; fall back to chat text.
 */
export async function resolveAgentDocOutput(
  chatOutput: string,
  workdir: string,
  options: ResolveAgentDocOutputOptions
): Promise<string> {
  const jsonMarkdown = extractMarkdownFromAgentJson(chatOutput);
  const chatDoc = stripGeneratedDocArtifacts(
    (jsonMarkdown ?? chatOutput).trim(),
    options.docType
  );

  if (!options.outputRelativePath) {
    return chatDoc;
  }

  const fileAfter = await readExistingDoc(
    workdir,
    options.outputRelativePath,
    options.docType
  );

  if (!fileAfter?.trim()) {
    return chatDoc;
  }

  const beforeTrim = options.fileContentBefore?.trim() ?? "";
  const afterTrim = fileAfter.trim();
  const fileChanged = afterTrim !== beforeTrim;
  const agentClaimsWritten = DOC_WRITTEN_RE.test(chatOutput);
  const chatTruncated = looksTruncatedDocOutput(chatDoc);
  const fileTruncated = looksTruncatedDocOutput(afterTrim);

  if (fileChanged && !fileTruncated) {
    return afterTrim;
  }

  if (
    fileAfter &&
    !fileTruncated &&
    (agentClaimsWritten || chatTruncated || afterTrim.length > chatDoc.length)
  ) {
    return afterTrim;
  }

  return chatDoc;
}

export function assertValidGeneratedDoc(
  content: string,
  existingContent?: string | null,
  options?: { isMergedUpdate?: boolean }
): void {
  const result = validateGeneratedDocContent(content, existingContent, options);
  if (!result.valid) {
    throw new Error(`Document generation produced incomplete output (${result.reason})`);
  }
}

/**
 * Parse section-update JSON from the agent, merge into the existing document,
 * write the merged file to disk, and return the full merged markdown.
 */
export async function applySectionUpdateFromAgent(
  chatOutput: string,
  workdir: string,
  outputRelativePath: string,
  existingContent: string,
  docType?: GeneratedDocType
): Promise<string> {
  const payload = parseDocSectionUpdatePayload(chatOutput);
  const fullDoc = tryBuildFullDocFromPayload(payload);
  let merged = fullDoc;
  if (merged === null) {
    try {
      merged = mergeDocSectionUpdates(existingContent, payload);
    } catch {
      // Merge failed (e.g. base doc has no ## headings) — build from payload.
      merged = buildFullDocFromAllSections(payload);
    }
  }
  if (payload.revisionSummary) {
    merged = appendRevisionHistoryRow(merged, payload.revisionSummary);
  }

  const absPath = join(workdir, outputRelativePath);
  await mkdir(dirname(absPath), { recursive: true });
  await writeFile(absPath, merged, "utf-8");

  return stripGeneratedDocArtifacts(merged, docType);
}

/**
 * Prefer the on-disk file the agent wrote when opening a repo PR / write-back.
 */
export async function preferDiskDocOutput(
  workdir: string,
  relativePath: string,
  agentContent: string,
  docType?: GeneratedDocType
): Promise<string> {
  const fromDisk = await readExistingDoc(workdir, relativePath, docType);
  if (!fromDisk?.trim()) return agentContent;

  const agentTrimmed = agentContent.trim();
  if (!agentTrimmed) return fromDisk;

  if (looksTruncatedDocOutput(agentTrimmed)) return fromDisk;
  if (fromDisk.length > agentTrimmed.length) return fromDisk;

  return agentTrimmed;
}
