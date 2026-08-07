import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { and, asc, desc, eq, max, sql } from "drizzle-orm";
import type { getDb } from "~/server/database";
import * as schema from "~/server/database/schema";
import type { McpDocRow } from "~/server/lib/mcp-doc-payload";
import { buildDocPublicUrls } from "~/server/lib/mcp-public-urls";
import {
  formatAdrNumber,
  parseAdrFrontmatter,
  type AdrFrontmatter,
  type AdrStatus,
} from "~/types/adr";

type Db = ReturnType<typeof getDb>;

export interface AdrDocRow extends McpDocRow {
  frontmatter?: Record<string, unknown> | null;
}

export interface ListAdrsOptions {
  appId?: string;
  adrStatus?: AdrStatus;
  bindingOnly?: boolean;
  scope?: string;
  includeContent?: boolean;
  limit?: number;
}

function adrBaseQuery(db: Db) {
  return db
    .select({
      id: schema.docs.id,
      appId: schema.docs.appId,
      title: schema.docs.title,
      content: schema.docs.content,
      status: schema.docs.status,
      versionId: schema.docs.versionId,
      tags: schema.docs.tags,
      author: schema.docs.author,
      source: schema.docs.source,
      docType: schema.docs.docType,
      externalId: schema.docs.externalId,
      siteId: schema.docs.siteId,
      slug: schema.docs.slug,
      frontmatter: schema.docs.frontmatter,
      createdAt: schema.docs.createdAt,
      updatedAt: schema.docs.updatedAt,
      appName: schema.apps.name,
      version: schema.appVersions.version,
      siteName: schema.docSites.name,
      siteSlug: schema.docSites.slug,
      siteStatus: schema.docSites.status,
    })
    .from(schema.docs)
    .leftJoin(schema.apps, eq(schema.docs.appId, schema.apps.id))
    .leftJoin(schema.appVersions, eq(schema.docs.versionId, schema.appVersions.id))
    .leftJoin(schema.docSites, eq(schema.docs.siteId, schema.docSites.id));
}

function scopeCondition(scope: string) {
  return sql`(
    ${schema.docs.frontmatter}->'scope' IS NULL
    OR jsonb_typeof(${schema.docs.frontmatter}->'scope') != 'array'
    OR jsonb_array_length(COALESCE(${schema.docs.frontmatter}->'scope', '[]'::jsonb)) = 0
    OR ${schema.docs.frontmatter}->'scope' ? ${scope}
  )`;
}

export function isBindingAdrDoc(doc: {
  docType?: string | null;
  status: string;
  frontmatter?: Record<string, unknown> | null;
}): boolean {
  if (doc.docType !== "adr") return false;
  if (doc.status !== "published") return false;
  const fm = parseAdrFrontmatter(doc.frontmatter ?? undefined);
  return fm.adr_status === "accepted";
}

export function extractDecisionSnippet(content: string | null | undefined): string {
  if (!content?.trim()) return "";

  const decisionMatch = content.match(
    /^##\s+Decision\s*\n+([\s\S]*?)(?=\n##\s+|\n#+\s+|$)/im
  );
  const section = decisionMatch?.[1]?.trim() || content.trim();

  const firstLine = section
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith("|"));

  if (!firstLine) return "";
  return firstLine.replace(/^[-*]\s+/, "").slice(0, 240);
}

export function adrDisplayLabel(
  title: string,
  frontmatter?: Record<string, unknown> | null
): string {
  const fm = parseAdrFrontmatter(frontmatter ?? undefined);
  return `${formatAdrNumber(fm.adr_number)}: ${title}`;
}

export function formatAdrConstraintSummary(rows: AdrDocRow[]): string {
  if (rows.length === 0) return "";

  const lines = rows.map((row) => {
    const label = formatAdrNumber(parseAdrFrontmatter(row.frontmatter ?? undefined).adr_number);
    const decision = extractDecisionSnippet(row.content);
    return `- ${label}: ${decision || row.title}`;
  });

  return `BINDING ADRs:\n${lines.join("\n")}`;
}

export function formatAdrApiItem(row: AdrDocRow, options?: { includeContent?: boolean }) {
  const fm = parseAdrFrontmatter(row.frontmatter ?? undefined);
  const binding = isBindingAdrDoc(row);
  const publicLinks = buildDocPublicUrls({
    id: row.id,
    status: row.status,
    slug: row.slug,
    siteId: row.siteId,
    siteSlug: row.siteSlug,
    siteStatus: row.siteStatus,
  });

  const base = {
    id: row.id,
    appId: row.appId,
    title: row.title,
    adrNumber: fm.adr_number ?? null,
    displayLabel: adrDisplayLabel(row.title, row.frontmatter),
    adrStatus: fm.adr_status ?? "proposed",
    docStatus: row.status,
    binding,
    scope: fm.scope ?? [],
    supersedes: fm.supersedes ?? null,
    date: fm.date ?? null,
    deciders: fm.deciders ?? [],
    decision: extractDecisionSnippet(row.content),
    publicPath: publicLinks.path,
    publicUrl: publicLinks.url,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    app: row.appName && row.appId ? { id: row.appId, name: row.appName } : null,
    frontmatter: row.frontmatter ?? {},
  };

  if (options?.includeContent) {
    return { ...base, content: row.content };
  }

  return base;
}

export async function listBindingAdrs(
  db: Db,
  appId: string,
  options?: { scope?: string; includeContent?: boolean }
): Promise<AdrDocRow[]> {
  const conditions = [
    eq(schema.docs.appId, appId),
    eq(schema.docs.docType, "adr"),
    eq(schema.docs.status, "published"),
    sql`${schema.docs.frontmatter}->>'adr_status' = 'accepted'`,
  ];

  if (options?.scope) {
    conditions.push(scopeCondition(options.scope));
  }

  const rows = await adrBaseQuery(db)
    .where(and(...conditions))
    .orderBy(
      sql`(${schema.docs.frontmatter}->>'adr_number')::int NULLS LAST`,
      asc(schema.docs.createdAt)
    );

  if (options?.includeContent === false) {
    return rows.map((row) => ({ ...row, content: null }));
  }

  return rows;
}

export async function listAdrs(db: Db, options: ListAdrsOptions = {}): Promise<AdrDocRow[]> {
  const conditions = [eq(schema.docs.docType, "adr")];

  if (options.appId) {
    conditions.push(eq(schema.docs.appId, options.appId));
  }

  if (options.bindingOnly) {
    conditions.push(eq(schema.docs.status, "published"));
    conditions.push(sql`${schema.docs.frontmatter}->>'adr_status' = 'accepted'`);
  } else if (options.adrStatus) {
    conditions.push(sql`${schema.docs.frontmatter}->>'adr_status' = ${options.adrStatus}`);
  }

  if (options.scope) {
    conditions.push(scopeCondition(options.scope));
  }

  let query = adrBaseQuery(db)
    .where(and(...conditions))
    .orderBy(
      sql`(${schema.docs.frontmatter}->>'adr_number')::int NULLS LAST`,
      desc(schema.docs.updatedAt)
    );

  if (options.limit && options.limit > 0) {
    query = query.limit(options.limit) as typeof query;
  }

  const rows = await query;

  if (options.includeContent === false) {
    return rows.map((row) => ({ ...row, content: null }));
  }

  return rows;
}

export async function getAdrById(db: Db, id: string): Promise<AdrDocRow | null> {
  const row = await adrBaseQuery(db).where(eq(schema.docs.id, id)).limit(1).then((rows) => rows[0]);
  if (!row || row.docType !== "adr") return null;
  return row;
}

export async function suggestNextAdrNumber(db: Db, appId: string): Promise<number> {
  const result = await db
    .select({
      maxNumber: max(sql`(${schema.docs.frontmatter}->>'adr_number')::int`),
    })
    .from(schema.docs)
    .where(and(eq(schema.docs.appId, appId), eq(schema.docs.docType, "adr")));

  const currentMax = result[0]?.maxNumber;
  if (currentMax == null) return 1;
  return Number(currentMax) + 1;
}

export async function loadAdrTemplate(): Promise<string> {
  const templatePath = join(process.cwd(), "templates", "adr_template.md");
  return readFile(templatePath, "utf-8");
}

export function renderAdrTemplate(
  template: string,
  params: {
    adrNumber: number;
    title: string;
    adrStatus?: AdrStatus;
    date?: string;
    deciders?: string[];
    scope?: string[];
  }
): string {
  const scopeLabel =
    params.scope && params.scope.length > 0 ? params.scope.join(", ") : "All";
  const decidersLabel =
    params.deciders && params.deciders.length > 0 ? params.deciders.join(", ") : "—";

  return template
    .replaceAll("{{ADR_NUMBER}}", String(params.adrNumber).padStart(3, "0"))
    .replaceAll("{{TITLE}}", params.title)
    .replaceAll("{{ADR_STATUS}}", params.adrStatus ?? "proposed")
    .replaceAll("{{DATE}}", params.date ?? new Date().toISOString().slice(0, 10))
    .replaceAll("{{DECIDERS}}", decidersLabel)
    .replaceAll("{{SCOPE}}", scopeLabel);
}

export function formatMcpAdrMetadata(row: {
  status: string;
  frontmatter?: Record<string, unknown> | null;
}) {
  const fm = parseAdrFrontmatter(row.frontmatter ?? undefined);
  return {
    number: fm.adr_number ?? null,
    status: fm.adr_status ?? "proposed",
    binding: isBindingAdrDoc({
      docType: "adr",
      status: row.status,
      frontmatter: row.frontmatter,
    }),
    scope: fm.scope ?? [],
    supersedes: fm.supersedes ?? null,
  };
}

export function defaultAdrFrontmatter(adrNumber: number): AdrFrontmatter {
  return {
    adr_status: "proposed",
    adr_number: adrNumber,
    date: new Date().toISOString().slice(0, 10),
  };
}
