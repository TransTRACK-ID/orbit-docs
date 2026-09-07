/**
 * Incremental document updates: agent sends changed sections only;
 * the system merges them into the existing markdown at the correct positions.
 */

export interface DocSectionUpdate {
  /** Heading line exactly as in the document, e.g. "## 5. Routing & Halaman" */
  heading: string;
  /** Section body — everything under the heading until the next peer heading. Do NOT repeat the heading line. */
  content: string;
}

export interface DocSectionUpdatePayload {
  sections: DocSectionUpdate[];
  /** Brief summary for the revision-history row (optional). */
  revisionSummary?: string;
}

interface ParsedSection {
  headingLine: string;
  level: number;
  /** Full section text including the heading line. */
  raw: string;
  normalizedHeading: string;
}

const HEADING_RE = /^(#{1,6})\s+(.+)$/;

function normalizeHeading(line: string): string {
  const m = line.match(HEADING_RE);
  const text = m ? m[2] : line.replace(/^#+\s*/, "");
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function splitMarkdownSections(doc: string): ParsedSection[] {
  const lines = doc.split("\n");
  const sections: ParsedSection[] = [];
  let i = 0;

  while (i < lines.length) {
    // Product docs use ## as top-level sections; keep ###+ nested inside.
    const match = lines[i].match(/^(##)\s+(.+)$/);
    if (!match) {
      i++;
      continue;
    }

    const level = match[1].length;
    const headingLine = lines[i];
    const start = i;
    i++;

    while (i < lines.length) {
      const next = lines[i].match(/^(##)\s+/);
      if (next) break;
      i++;
    }

    sections.push({
      headingLine,
      level,
      raw: lines.slice(start, i).join("\n"),
      normalizedHeading: normalizeHeading(headingLine),
    });
  }

  return sections;
}

/**
 * Wrap bare Mermaid diagram code (missing ```mermaid fences) in proper markdown code fences.
 */
export function normalizeMarkdownDiagrams(content: string): string {
  return content.replace(
    /(^|\n\n)(?!```)mermaid\s*\n((?:flowchart|sequenceDiagram|classDiagram|erDiagram|stateDiagram|gantt|pie|gitGraph|C4Context)[\s\S]*?)(?=(\n\n(?:[#|*-]|\d+\.|\w+:|```)|$))/gi,
    (_match, prefix, diagramBody) => `${prefix}\`\`\`mermaid\n${diagramBody.trim()}\n\`\`\``
  );
}

function formatSection(headingLine: string, body: string): string {
  const normalizedBody = normalizeMarkdownDiagrams(body);
  const trimmedBody = normalizedBody.replace(/^\n+/, "").replace(/\n+$/, "");
  if (!trimmedBody) return headingLine;
  return `${headingLine}\n\n${trimmedBody}`;
}


function findSectionIndex(sections: ParsedSection[], heading: string): number {
  const normalized = normalizeHeading(heading);
  const exact = sections.findIndex((s) => s.normalizedHeading === normalized);
  if (exact >= 0) return exact;

  const stripped = heading.replace(/^#+\s*/, "").trim().toLowerCase();
  return sections.findIndex((s) => s.normalizedHeading === stripped.replace(/\s+/g, " "));
}

export function mergeDocSectionUpdates(
  baseDoc: string,
  payload: DocSectionUpdatePayload
): string {
  if (!payload.sections.length) {
    return baseDoc;
  }

  const sections = splitMarkdownSections(baseDoc);
  if (sections.length === 0) {
    throw new Error("Existing document has no markdown headings to merge into");
  }

  const replaced = new Set<number>();
  const appended: DocSectionUpdate[] = [];

  for (const update of payload.sections) {
    const idx = findSectionIndex(sections, update.heading);
    if (idx < 0) {
      // Heading not found — collect for appending instead of failing.
      appended.push(update);
      continue;
    }

    sections[idx] = {
      ...sections[idx],
      raw: formatSection(sections[idx].headingLine, update.content),
    };
    replaced.add(idx);
  }

  // Append sections whose headings didn't match any existing section.
  for (const update of appended) {
    sections.push({
      headingLine: update.heading,
      level: 2,
      raw: formatSection(update.heading, update.content),
      normalizedHeading: normalizeHeading(update.heading),
    });
  }

  if (replaced.size === 0 && appended.length === 0) {
    return baseDoc;
  }

  // Reconstruct: preserve preamble (content before first ## section) + merged sections.
  const firstSection = sections[0];
  const preambleEnd = baseDoc.indexOf(firstSection.headingLine);
  const preamble = preambleEnd > 0 ? baseDoc.slice(0, preambleEnd).replace(/\s+$/, "") : "";

  const body = sections.map((s) => s.raw).join("\n\n");
  if (preamble) return `${preamble}\n\n${body}`;
  return body;
}

export function appendRevisionHistoryRow(doc: string, summary: string): string {
  const sections = splitMarkdownSections(doc);
  const idx = sections.findIndex((s) => {
    const norm = normalizeHeading(s.headingLine);
    return norm === "riwayat revisi" || norm === "revision history";
  });

  if (idx < 0) {
    const date = new Date().toISOString().slice(0, 10);
    const block =
      `\n\n## Riwayat Revisi\n\n| Versi | Tanggal | Perubahan | Author |\n|---|---|---|---|\n| — | ${date} | ${summary} | Orbit Docs Agent |`;
    return doc.trimEnd() + block;
  }

  const section = sections[idx];
  const date = new Date().toISOString().slice(0, 10);
  const row = `| — | ${date} | ${summary} | Orbit Docs Agent |`;
  sections[idx] = {
    ...section,
    raw: `${section.raw.trimEnd()}\n${row}`,
  };

  const firstSection = sections[0];
  const preambleEnd = doc.indexOf(firstSection.headingLine);
  const preamble = preambleEnd > 0 ? doc.slice(0, preambleEnd).replace(/\s+$/, "") : "";
  const body = sections.map((s) => s.raw).join("\n\n");
  return preamble ? `${preamble}\n\n${body}` : body;
}

/** Pull JSON update payload out of agent output (may include prose or fences). */
export function extractDocSectionUpdateJson(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Section update response was empty");
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  const start = trimmed.indexOf("{");
  if (start === -1) {
    throw new Error("Section update response did not contain JSON");
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }

  throw new Error("Section update response contained incomplete JSON");
}

/** When the agent returns a single H1 heading + body, treat it as a full document. */
export function tryBuildFullDocFromPayload(payload: DocSectionUpdatePayload): string | null {
  if (payload.sections.length !== 1) return null;

  const { heading, content } = payload.sections[0];
  const h = heading.trim();
  if (!/^#\s+/.test(h) || /^##/.test(h)) return null;

  const body = content.trim();
  return body ? `${h}\n\n${body}` : h;
}

/** Build a standalone markdown document from all sections in a payload. */
export function buildFullDocFromAllSections(payload: DocSectionUpdatePayload): string {
  return payload.sections.map((s) => formatSection(s.heading, s.content)).join("\n\n");
}

/** Extract a complete markdown document embedded in agent JSON output. */
export function extractFullMarkdownFromAgentJson(raw: string): string | null {
  try {
    const payload = parseDocSectionUpdatePayload(raw);
    return tryBuildFullDocFromPayload(payload);
  } catch {
    return null;
  }
}

export function parseDocSectionUpdatePayload(raw: string): DocSectionUpdatePayload {
  const jsonText = extractDocSectionUpdateJson(raw);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText) as Record<string, unknown>;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Section update JSON is invalid (${detail})`);
  }

  if (
    !Array.isArray(parsed.sections) &&
    typeof parsed.heading === "string" &&
    typeof parsed.content === "string"
  ) {
    parsed.sections = [{ heading: parsed.heading, content: parsed.content }];
  }

  if (!Array.isArray(parsed.sections)) {
    throw new Error("Section update JSON must include a sections array");
  }

  const sections: DocSectionUpdate[] = [];
  for (const item of parsed.sections) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (typeof record.heading !== "string" || typeof record.content !== "string") {
      continue;
    }
    const heading = record.heading.trim();
    if (!heading) continue;
    sections.push({ heading, content: normalizeMarkdownDiagrams(record.content) });
  }

  if (sections.length === 0) {
    throw new Error("Section update JSON did not include any valid sections");
  }

  return {
    sections,
    revisionSummary:
      typeof parsed.revisionSummary === "string" && parsed.revisionSummary.trim()
        ? parsed.revisionSummary.trim()
        : undefined,
  };
}
