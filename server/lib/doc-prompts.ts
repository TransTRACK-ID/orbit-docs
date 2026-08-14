/**
 * Prompt builders for document generation.
 *
 * Each doc type has two variants:
 * - `build*CreatePrompt`: used when NO existing document is found in the repo
 * - `build*UpdatePrompt`: used when an existing document IS found; the agent
 *   must update it while preserving structure and unchanged sections.
 */

export const ADR_UPDATE_ALIGNMENT_NOTE = `When updating this document, preserve alignment with binding ADRs listed above.
If the codebase has drifted from an ADR, note the drift in a "Deviations" section
rather than silently overwriting the ADR's intent.`;

export function prependAdrConstraints(
  prompt: string,
  constraintSummary: string,
  options?: { isUpdate?: boolean }
): string {
  if (!constraintSummary.trim()) return prompt;

  let block = `BINDING ARCHITECTURAL DECISIONS (you MUST NOT contradict these):

${constraintSummary}`;

  if (options?.isUpdate) {
    block += `\n\n${ADR_UPDATE_ALIGNMENT_NOTE}`;
  }

  return `${block}

---

${prompt}`;
}

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

// ── Wiki (internal multi-page sites) ───────────────────────────

export interface WikiOutlinePagePlan {
  slug: string;
  title: string;
  group?: string;
  sourceFiles?: string[];
}

export interface WikiSitePlan {
  siteName: string;
  siteSlug: string;
  pages: WikiOutlinePagePlan[];
}

export function buildWikiOutlinePrompt(
  aggregateContext: string,
  baseDir: string,
  appName: string
): string {
  return `You are an expert software architect. Analyze the codebase under ${baseDir} and design an internal wiki site plan for the product "${appName}".

${aggregateContext}

Output ONLY valid JSON (no markdown fences) matching this schema:
{
  "siteName": "Human-readable site title",
  "siteSlug": "lowercase-hyphen-slug",
  "pages": [
    {
      "slug": "1-overview",
      "title": "Overview",
      "group": "Core",
      "sourceFiles": ["README.md", "src/main.ts"]
    }
  ]
}

Rules:
- The first page MUST be slug "1-overview" titled "Overview".
- Use numbered slugs: 1-overview, 2-subsystem-name, 3-another-topic (lowercase, hyphens).
- Group related pages (e.g. Components, Guides, Core). Use 4–12 pages total.
- sourceFiles: repo-relative paths that anchor each page (README, key modules).
- siteSlug: lowercase letters, numbers, hyphens only.
- Cover major subsystems, architecture, and setup—not every file.
- Output ONLY the JSON object.`;
}

export function buildWikiPagePrompt(
  template: string,
  page: WikiOutlinePagePlan,
  siteSlug: string,
  allPages: WikiOutlinePagePlan[],
  aggregateContext: string,
  baseDir: string,
  isOverview: boolean
): string {
  const siblingLinks = allPages
    .filter((p) => p.slug !== page.slug)
    .map((p) => `- [${p.title}](/wiki/${siteSlug}/${p.slug})`)
    .join("\n");

  const sourceList =
    page.sourceFiles?.length
      ? page.sourceFiles.map((f) => `- ${f}`).join("\n")
      : "- (infer from codebase)";

  return `You are writing one page of an internal wiki for a codebase under ${baseDir}.

${aggregateContext}

Page slug: ${page.slug}
Page title: ${page.title}
Site slug: ${siteSlug}
Is overview page: ${isOverview ? "yes" : "no"}

Sibling pages (use these exact markdown links in "Related pages" or cross-references):
${siblingLinks}

Relevant source files for this page:
${sourceList}

Template structure:
${template}

Instructions:
- Fill ALL template sections with real content from the codebase.
- Include a "## Relevant source files" section with a bullet list of repo-relative paths.
- Link to sibling wiki pages using markdown: /wiki/${siteSlug}/{page-slug}
- On the overview page, include a Mermaid architecture diagram in a fenced \`\`\`mermaid code block.
- Use tables where helpful. No placeholder text.
- Output ONLY the completed markdown document.`;
}

/** Pull a JSON object out of agent output that may include prose or markdown fences. */
export function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Wiki outline response was empty");
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  const start = trimmed.indexOf("{");
  if (start === -1) {
    const preview = trimmed.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(
      `Wiki outline response did not contain JSON (got: "${preview}${trimmed.length > 120 ? "…" : ""}")`
    );
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        return trimmed.slice(start, i + 1);
      }
    }
  }

  throw new Error("Wiki outline response contained incomplete JSON");
}

export function parseWikiOutlineJson(raw: string): WikiSitePlan {
  const jsonText = extractJsonObject(raw);
  let parsed: WikiSitePlan;
  try {
    parsed = JSON.parse(jsonText) as WikiSitePlan;
  } catch (err) {
    const preview = jsonText.slice(0, 120).replace(/\s+/g, " ");
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Wiki outline JSON is invalid (${detail}). Extracted: "${preview}…"`);
  }
  if (!parsed.siteName || !parsed.siteSlug || !Array.isArray(parsed.pages) || parsed.pages.length === 0) {
    throw new Error("Wiki outline JSON is missing siteName, siteSlug, or pages");
  }
  return parsed;
}
