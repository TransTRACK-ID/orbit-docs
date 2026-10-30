import { and, asc, eq, isNull, ne, type SQL } from "drizzle-orm";
import { getDb, pool } from "~/server/database";
import { apps, docs, docSites } from "~/server/database/schema";
import { slugify } from "~/server/lib/nav-config";

/* ------------------------------------------------------------------ */
/* Virtual paths                                                       */
/* ------------------------------------------------------------------ */

export const WORKSPACE_PATH_SEGMENT = "_workspace";

export interface DocPathInput {
  id: string;
  title: string;
  docType: string | null;
  source: string;
  externalId: string | null;
  slug: string | null;
  siteSlug: string | null;
  createdAt: Date | null;
}

export type DocCategory = "product" | "knowledge";

export function docCategoryOf(row: { source: string; docType: string | null }): DocCategory {
  return row.source === "op_sync" && row.docType === "feature" ? "knowledge" : "product";
}

export function appPathSegment(app: { id: string | null; name: string | null }): string {
  if (!app.id) return WORKSPACE_PATH_SEGMENT;
  return slugify(app.name ?? "") || app.id;
}

function docFileStem(row: DocPathInput): string {
  const base =
    docCategoryOf(row) === "knowledge" && row.externalId ? row.externalId : row.slug || row.title;
  return slugify(base) || "doc";
}

function docDirectory(appSegment: string, row: DocPathInput): string {
  if (row.docType === "wiki") {
    return `/${appSegment}/wiki/${slugify(row.siteSlug ?? "") || "unsorted"}`;
  }
  return `/${appSegment}/${docCategoryOf(row)}/${row.docType ?? "other"}`;
}

/**
 * Deterministic virtual paths such as `/order-planning/product/sdd/system-design.md`,
 * `/order-planning/knowledge/feature/feat-123.md`, `/order-planning/wiki/{site}/{page}.md`.
 * Older docs keep the plain name on collisions; newer ones get an id suffix.
 */
export function buildDocPaths(appSegment: string, rows: DocPathInput[]): Map<string, string> {
  const sorted = [...rows].sort((a, b) => {
    const at = a.createdAt?.getTime() ?? 0;
    const bt = b.createdAt?.getTime() ?? 0;
    return at - bt || a.id.localeCompare(b.id);
  });

  const used = new Set<string>();
  const paths = new Map<string, string>();
  for (const row of sorted) {
    const dir = docDirectory(appSegment, row);
    const stem = docFileStem(row);
    let path = `${dir}/${stem}.md`;
    if (used.has(path)) path = `${dir}/${stem}-${row.id.slice(0, 8)}.md`;
    used.add(path);
    paths.set(row.id, path);
  }
  return paths;
}

/* ------------------------------------------------------------------ */
/* Markdown line helpers                                               */
/* ------------------------------------------------------------------ */

export interface OutlineEntry {
  line: number;
  level: number;
  text: string;
}

/** Headings with 1-based line numbers, ignoring `#` lines inside fenced code blocks. */
export function extractOutline(content: string): OutlineEntry[] {
  const outline: OutlineEntry[] = [];
  let inFence = false;
  content.split("\n").forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (match) outline.push({ line: index + 1, level: match[1]!.length, text: match[2]!.trim() });
  });
  return outline;
}

function normalizeHeadingText(text: string): string {
  return text.replace(/^#+\s*/, "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** 1-based inclusive line range of the section under `heading` (exact match first, then substring). */
export function findSectionRange(
  content: string,
  heading: string,
): { startLine: number; endLine: number; heading: string } | null {
  const outline = extractOutline(content);
  const wanted = normalizeHeadingText(heading);
  if (!wanted) return null;

  let index = outline.findIndex((entry) => normalizeHeadingText(entry.text) === wanted);
  if (index < 0) index = outline.findIndex((entry) => normalizeHeadingText(entry.text).includes(wanted));
  if (index < 0) return null;

  const entry = outline[index]!;
  const next = outline.slice(index + 1).find((candidate) => candidate.level <= entry.level);
  const totalLines = content.split("\n").length;
  return {
    startLine: entry.line,
    endLine: next ? next.line - 1 : totalLines,
    heading: entry.text,
  };
}

export function formatNumberedLines(lines: string[], startLine: number): string {
  const width = String(startLine + lines.length - 1).length;
  return lines
    .map((line, i) => `${String(startLine + i).padStart(width, " ")}| ${line}`)
    .join("\n");
}

const MAX_GREP_LINE_CHARS = 500;

function clipLine(line: string): string {
  return line.length > MAX_GREP_LINE_CHARS ? `${line.slice(0, MAX_GREP_LINE_CHARS)}…` : line;
}

export interface GrepLineMatch {
  line: number;
  text: string;
  contextBefore: string[];
  contextAfter: string[];
}

export function grepContentLines(
  content: string,
  matcher: RegExp,
  options: { contextLines: number; maxMatches: number },
): GrepLineMatch[] {
  const lines = content.split("\n");
  const matches: GrepLineMatch[] = [];
  for (let i = 0; i < lines.length && matches.length < options.maxMatches; i++) {
    matcher.lastIndex = 0;
    if (!matcher.test(lines[i]!)) continue;
    matches.push({
      line: i + 1,
      text: clipLine(lines[i]!),
      contextBefore: lines.slice(Math.max(0, i - options.contextLines), i).map(clipLine),
      contextAfter: lines.slice(i + 1, i + 1 + options.contextLines).map(clipLine),
    });
  }
  return matches;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const MAX_GREP_PATTERN_LENGTH = 200;

export function buildGrepMatcher(pattern: string, options: { regex: boolean; caseSensitive: boolean }): RegExp {
  if (!pattern || pattern.length > MAX_GREP_PATTERN_LENGTH) {
    throw new Error(`pattern must be 1-${MAX_GREP_PATTERN_LENGTH} characters`);
  }
  return new RegExp(options.regex ? pattern : escapeRegExp(pattern), options.caseSensitive ? "" : "i");
}

/* ------------------------------------------------------------------ */
/* Data access                                                         */
/* ------------------------------------------------------------------ */

export interface DocToolsAppRef {
  id: string | null;
  name: string | null;
}

interface DocFilters {
  category?: DocCategory;
  docType?: string;
}

function appCondition(appId: string | null): SQL {
  return appId ? eq(docs.appId, appId) : isNull(docs.appId);
}

export async function buildDocPathIndex(app: DocToolsAppRef): Promise<Map<string, string>> {
  const db = getDb();
  const rows = await db
    .select({
      id: docs.id,
      title: docs.title,
      docType: docs.docType,
      source: docs.source,
      externalId: docs.externalId,
      slug: docs.slug,
      siteSlug: docSites.slug,
      createdAt: docs.createdAt,
    })
    .from(docs)
    .leftJoin(docSites, eq(docSites.id, docs.siteId))
    .where(and(appCondition(app.id), ne(docs.status, "archived")));
  return buildDocPaths(appPathSegment(app), rows);
}

function matchesFilters(row: { source: string; docType: string | null }, filters: DocFilters): boolean {
  if (filters.docType && row.docType !== filters.docType) return false;
  if (filters.category && docCategoryOf(row) !== filters.category) return false;
  return true;
}

export interface DocTreeEntry {
  path: string;
  docId: string;
  title: string;
  docType: string | null;
  category: DocCategory;
  status: string;
  lines: number;
  outline?: string[];
}

export async function listDocTree(
  params: DocFilters & {
    app: DocToolsAppRef;
    prefix?: string;
    includeOutline?: boolean;
    limit?: number;
  },
): Promise<{ entries: DocTreeEntry[]; total: number; truncated: boolean }> {
  const db = getDb();
  const rows = await db
    .select({
      id: docs.id,
      title: docs.title,
      content: docs.content,
      docType: docs.docType,
      source: docs.source,
      status: docs.status,
      externalId: docs.externalId,
      slug: docs.slug,
      siteSlug: docSites.slug,
      createdAt: docs.createdAt,
    })
    .from(docs)
    .leftJoin(docSites, eq(docSites.id, docs.siteId))
    .where(and(appCondition(params.app.id), ne(docs.status, "archived")))
    .orderBy(asc(docs.createdAt));

  const paths = buildDocPaths(appPathSegment(params.app), rows);
  const prefix = params.prefix?.trim();
  const limit = params.limit ?? 200;

  const entries = rows
    .filter((row) => matchesFilters(row, params))
    .map((row) => ({ row, path: paths.get(row.id)! }))
    .filter(({ path }) => !prefix || path.startsWith(prefix))
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    total: entries.length,
    truncated: entries.length > limit,
    entries: entries.slice(0, limit).map(({ row, path }) => {
      const content = row.content ?? "";
      return {
        path,
        docId: row.id,
        title: row.title,
        docType: row.docType,
        category: docCategoryOf(row),
        status: row.status,
        lines: content ? content.split("\n").length : 0,
        ...(params.includeOutline === false
          ? {}
          : {
              outline: extractOutline(content)
                .filter((entry) => entry.level <= 3)
                .map((entry) => `${entry.line}: ${"#".repeat(entry.level)} ${entry.text}`),
            }),
      };
    }),
  };
}

export interface GrepDocMatch extends GrepLineMatch {
  path: string;
  docId: string;
  title: string;
  docType: string | null;
}

const GREP_CANDIDATE_LIMIT = 500;
const GREP_STATEMENT_TIMEOUT_MS = 5000;

export async function grepDocs(
  params: DocFilters & {
    app: DocToolsAppRef;
    pattern: string;
    regex?: boolean;
    caseSensitive?: boolean;
    contextLines?: number;
    maxResults?: number;
    maxPerDoc?: number;
    publishedOnly?: boolean;
  },
): Promise<{ matches: GrepDocMatch[]; docsMatched: number; truncated: boolean }> {
  const regex = params.regex ?? false;
  const caseSensitive = params.caseSensitive ?? false;
  const matcher = buildGrepMatcher(params.pattern, { regex, caseSensitive });
  const maxResults = params.maxResults ?? 50;
  const maxPerDoc = params.maxPerDoc ?? 10;
  const contextLines = params.contextLines ?? 2;

  const values: unknown[] = [];
  const where: string[] = [params.publishedOnly ? "d.status = 'published'" : "d.status <> 'archived'"];
  if (params.app.id) {
    values.push(params.app.id);
    where.push(`d.app_id = $${values.length}`);
  } else {
    where.push("d.app_id IS NULL");
  }

  if (regex) {
    values.push(params.pattern);
    where.push(`d.content ${caseSensitive ? "~" : "~*"} $${values.length}`);
  } else {
    values.push(`%${params.pattern.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
    where.push(`d.content ${caseSensitive ? "LIKE" : "ILIKE"} $${values.length}`);
  }

  if (params.docType) {
    values.push(params.docType);
    where.push(`d.doc_type = $${values.length}`);
  }
  if (params.category === "knowledge") {
    where.push(`(d.source = 'op_sync' AND d.doc_type = 'feature')`);
  } else if (params.category === "product") {
    where.push(`NOT (d.source = 'op_sync' AND d.doc_type = 'feature')`);
  }

  const client = await pool.connect();
  let rows: Array<{ id: string; title: string; doc_type: string | null; content: string | null }>;
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = ${GREP_STATEMENT_TIMEOUT_MS}`);
    const result = await client.query(
      `SELECT d.id, d.title, d.doc_type, d.content
       FROM docs d
       WHERE ${where.join(" AND ")}
       ORDER BY d.updated_at DESC NULLS LAST
       LIMIT ${GREP_CANDIDATE_LIMIT}`,
      values,
    );
    await client.query("COMMIT");
    rows = result.rows;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const paths = await buildDocPathIndex(params.app);
  const matches: GrepDocMatch[] = [];
  let docsMatched = 0;
  let truncated = rows.length >= GREP_CANDIDATE_LIMIT;

  for (const row of rows) {
    if (matches.length >= maxResults) {
      truncated = true;
      break;
    }
    const lineMatches = grepContentLines(row.content ?? "", matcher, {
      contextLines,
      maxMatches: Math.min(maxPerDoc, maxResults - matches.length),
    });
    if (lineMatches.length === 0) continue;
    docsMatched += 1;
    for (const match of lineMatches) {
      matches.push({
        ...match,
        path: paths.get(row.id) ?? "",
        docId: row.id,
        title: row.title,
        docType: row.doc_type,
      });
    }
  }

  return { matches, docsMatched, truncated };
}

async function resolveAppFromPath(path: string): Promise<DocToolsAppRef | null> {
  const segment = path.split("/").filter(Boolean)[0];
  if (!segment) return null;
  if (segment === WORKSPACE_PATH_SEGMENT) return { id: null, name: null };

  const db = getDb();
  const rows = await db.select({ id: apps.id, name: apps.name }).from(apps);
  return rows.find((app) => appPathSegment(app) === segment) ?? null;
}

export const DEFAULT_READ_MAX_LINES = 400;

export interface ReadDocSectionResult {
  docId: string;
  title: string;
  path: string;
  docType: string | null;
  status: string;
  totalLines: number;
  startLine: number;
  endLine: number;
  truncated: boolean;
  heading?: string;
  content: string;
}

export async function readDocSection(params: {
  docId?: string;
  path?: string;
  app?: DocToolsAppRef;
  heading?: string;
  startLine?: number;
  endLine?: number;
  maxLines?: number;
}): Promise<ReadDocSectionResult | { error: string; outline?: string[]; path?: string }> {
  const db = getDb();
  let docId = params.docId;
  let app = params.app?.id ? params.app : undefined;
  let paths: Map<string, string> | undefined;

  if (!docId && params.path) {
    const path = params.path.trim();
    app = app ?? (await resolveAppFromPath(path)) ?? undefined;
    if (!app) return { error: "App in path not found", path };
    paths = await buildDocPathIndex(app);
    docId = [...paths.entries()].find(([, candidate]) => candidate === path)?.[0];
    if (!docId) return { error: "No doc at this path (call list_doc_tree for valid paths)", path };
  }
  if (!docId) return { error: "Provide docId or path" };

  const row = await db
    .select({
      id: docs.id,
      appId: docs.appId,
      appName: apps.name,
      title: docs.title,
      content: docs.content,
      docType: docs.docType,
      status: docs.status,
    })
    .from(docs)
    .leftJoin(apps, eq(apps.id, docs.appId))
    .where(eq(docs.id, docId))
    .limit(1)
    .then((rows) => rows[0]);
  if (!row) return { error: "Doc not found" };

  if (!paths) paths = await buildDocPathIndex({ id: row.appId, name: row.appName });
  const path = paths.get(row.id) ?? "";
  const content = row.content ?? "";
  const lines = content.split("\n");
  const totalLines = lines.length;

  let startLine = 1;
  let endLine = totalLines;
  let heading: string | undefined;

  if (params.heading) {
    const range = findSectionRange(content, params.heading);
    if (!range) {
      return {
        error: `Heading not found: ${params.heading}`,
        path,
        outline: extractOutline(content).map(
          (entry) => `${entry.line}: ${"#".repeat(entry.level)} ${entry.text}`,
        ),
      };
    }
    ({ startLine, endLine, heading } = range);
  } else {
    startLine = Math.min(Math.max(params.startLine ?? 1, 1), totalLines);
    endLine = Math.min(Math.max(params.endLine ?? totalLines, startLine), totalLines);
  }

  const maxLines = params.maxLines ?? DEFAULT_READ_MAX_LINES;
  const truncated = endLine - startLine + 1 > maxLines;
  if (truncated) endLine = startLine + maxLines - 1;

  return {
    docId: row.id,
    title: row.title,
    path,
    docType: row.docType,
    status: row.status,
    totalLines,
    startLine,
    endLine,
    truncated,
    ...(heading ? { heading } : {}),
    content: formatNumberedLines(lines.slice(startLine - 1, endLine), startLine),
  };
}
