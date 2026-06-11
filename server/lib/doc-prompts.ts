/**
 * Prompt builders for document generation.
 *
 * Each doc type has two variants:
 * - `build*CreatePrompt`: used when NO existing document is found in the repo
 * - `build*UpdatePrompt`: used when an existing document IS found; the agent
 *   must update it while preserving structure and unchanged sections.
 */

// ── PRD (internal type = srs, UI = PRD) ─────────────────────────

export function buildPrdCreatePrompt(
  template: string,
  aggregateContext: string,
  baseDir: string
): string {
  return `You are an expert software architect. You have been given access to multiple cloned Git repositories that together make up a single product. The repositories live under: ${baseDir}

Analyze ALL repositories using your tools (read files, bash: find, cat, grep) and produce a single, product-wide Product Requirements Document (PRD) that covers the whole product across its repositories.

${aggregateContext}

Use the following template structure and fill in ALL sections with real content derived from the codebases:

${template}

Instructions:
- Treat the repositories as one product; describe product-level requirements, not per-repo internals.
- Fill in all {{placeholders}} with actual content. Do NOT use placeholder text.
- Output ONLY the completed markdown document.`;
}

export function buildPrdUpdatePrompt(
  existingPrd: string,
  aggregateContext: string,
  baseDir: string
): string {
  return `You are an expert software architect. You have been given access to multiple cloned Git repositories that together make up a single product. The repositories live under: ${baseDir}

An existing Product Requirements Document (PRD) was found. Update it so it accurately reflects the current state of the product across ALL repositories. Keep sections that are unaffected unchanged.

${aggregateContext}

EXISTING PRD:
${existingPrd}

Instructions:
- Output the COMPLETE updated PRD markdown document (not just the changed parts).
- Preserve the existing structure and headings.
- Keep unchanged sections as-is.
- Do not add a second document or duplicate headings.
- Do NOT use placeholder text.
- Output ONLY the markdown document.`;
}

// ── FSD ─────────────────────────────────────────────────────────

export function buildFsdCreatePrompt(
  template: string,
  aggregateContext: string,
  baseDir: string,
  prdExcerpt: string
): string {
  return `You are an expert software architect with access to multiple cloned repositories that form one product under: ${baseDir}

Analyze ALL repositories and produce a single, product-wide Functional Specification Document (FSD).

${aggregateContext}

Product PRD (for reference):
${prdExcerpt}

Use the following template structure and fill in ALL sections with real content:

${template}

Instructions:
- Focus on cross-repository user workflows, UI behavior, and functional requirements at the product level.
- Fill in all {{placeholders}} with actual content. Do NOT use placeholder text.
- Output ONLY the completed markdown document.`;
}

export function buildFsdUpdatePrompt(
  existingFsd: string,
  aggregateContext: string,
  baseDir: string,
  prdExcerpt: string
): string {
  return `You are an expert software architect with access to multiple cloned repositories that form one product under: ${baseDir}

An existing Functional Specification Document (FSD) was found. Update it so it accurately reflects the current state of the product. Keep sections that are unaffected unchanged.

${aggregateContext}

Product PRD (for reference):
${prdExcerpt}

EXISTING FSD:
${existingFsd}

Instructions:
- Output the COMPLETE updated FSD markdown document (not just the changed parts).
- Preserve the existing structure and headings.
- Keep unchanged sections as-is.
- Do not add a second document or duplicate headings.
- Do NOT use placeholder text.
- Output ONLY the markdown document.`;
}

// ── SDD ─────────────────────────────────────────────────────────

export function buildSddCreatePrompt(
  template: string,
  cloneDir: string,
  repoName: string,
  repoContext: string,
  prdExcerpt: string,
  fsdExcerpt: string
): string {
  return `You are an expert software architect. You have been given access to a cloned Git repository "${repoName}" at the path: ${cloneDir}

Your task is to deeply analyze this repository using your available tools (read files, run bash commands like find, cat, grep, etc.) and then generate a complete System Design Document (SDD) for THIS repository specifically.

Structural overview:
${repoContext}

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

export function buildSddUpdatePrompt(
  existingSdd: string,
  cloneDir: string,
  repoName: string,
  repoContext: string,
  prdExcerpt: string,
  fsdExcerpt: string
): string {
  return `You are an expert software architect maintaining the System Design Document (SDD) for the repository "${repoName}" located at ${cloneDir}.

An existing SDD was found. Update it so it accurately reflects the current state of the repository. Keep sections that are unaffected unchanged.

Structural overview:
${repoContext}

Product-level PRD (for reference):
${prdExcerpt}

Product-level FSD (for reference):
${fsdExcerpt}

EXISTING SDD:
${existingSdd}

Instructions:
- Output the COMPLETE updated SDD markdown document (not just the changed parts).
- Preserve the existing structure and headings.
- Keep unchanged sections as-is.
- Do not add a second document or duplicate headings.
- Do NOT use placeholder text.
- Output ONLY the markdown document.`;
}

/**
 * Build a prompt for incremental SDD update from a diff (webhook path).
 * Used when we have both an existing SDD and a code diff.
 */
export function buildSddDiffUpdatePrompt(
  existingSdd: string,
  repoName: string,
  cloneDir: string,
  newTag: string,
  changedFiles: string[],
  patch: string
): string {
  return `You are an expert software architect maintaining the System Design Document (SDD) for the repository "${repoName}" located at ${cloneDir}.

A new release "${newTag}" was created. Below is the EXISTING SDD followed by the code changes since the last documented version. Update the SDD so it accurately reflects the changes. Keep sections that are unaffected unchanged. Only read additional files from ${cloneDir} if strictly necessary to understand a change.

Changed files (${changedFiles.length}):
${changedFiles.slice(0, 100).join("\n")}

Code diff:
\`\`\`diff
${patch}
\`\`\`

EXISTING SDD:
${existingSdd}

Instructions:
- Output the COMPLETE updated SDD markdown document (not just the changed parts).
- Preserve the existing structure and headings.
- Do NOT use placeholder text.
- Output ONLY the markdown document.`;
}
