export const TERMINAL_DOC_GENERATION_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
]);

export function isPendingDocGenerationStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return !TERMINAL_DOC_GENERATION_STATUSES.has(status);
}

export const DOC_GENERATION_STATUS_LABEL: Record<string, string> = {
  cloning: "Cloning",
  analyzing: "Analyzing",
  generating_srs: "Generating SRS",
  generating_fsd: "Generating FSD",
  generating_git_snapshot: "Git Snapshot",
  generating_sdd_index: "SDD Index",
  generating_sdd: "Generating SDD",
  generating_wiki_outline: "Wiki outline",
  generating_wiki_pages: "Wiki pages",
  writing_back: "Writing back",
  completed: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const DOC_GENERATION_STATUS_FULL: Record<string, string> = {
  cloning: "Cloning repositories…",
  analyzing: "Analyzing codebases…",
  generating_srs: "Writing Software Requirements Specification…",
  generating_fsd: "Writing Functional Specification Document…",
  generating_git_snapshot: "Writing Git Snapshot reference…",
  generating_sdd_index: "Writing SDD index document…",
  generating_sdd: "Writing System Design Documents…",
  generating_wiki_outline: "Planning wiki structure…",
  generating_wiki_pages: "Writing wiki pages…",
  writing_back: "Opening pull requests…",
  completed: "All documents generated!",
  failed: "Generation failed",
  cancelled: "Generation cancelled",
};
