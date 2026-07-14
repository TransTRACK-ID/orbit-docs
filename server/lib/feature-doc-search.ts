import { and, eq, sql, desc, inArray, not } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docs } from "~/server/database/schema";
import { moduleTag } from "~/server/lib/feature-docs";

export interface FeatureDocSearchResult {
  id: string;
  title: string;
  content: string | null;
  status: string;
  externalId: string | null;
  tags: string[] | null;
}

export async function findFeatureDocByExternalId(
  appId: string,
  featureId: string,
): Promise<typeof docs.$inferSelect | null> {
  const db = getDb();
  const row = await db
    .select()
    .from(docs)
    .where(
      and(
        eq(docs.appId, appId),
        eq(docs.externalId, featureId),
        eq(docs.docType, "feature"),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] || null);

  return row;
}

export async function searchFeatureDocs(params: {
  appId: string;
  query: string;
  module?: string;
  limit?: number;
  publishedOnly?: boolean;
}): Promise<FeatureDocSearchResult[]> {
  const db = getDb();
  const limit = params.limit ?? 8;
  const query = params.query.trim();
  const conditions = [
    eq(docs.appId, params.appId),
    eq(docs.docType, "feature"),
    eq(docs.source, "op_sync"),
  ];

  if (params.publishedOnly) {
    conditions.push(eq(docs.status, "published"));
  }

  if (params.module?.trim()) {
    conditions.push(sql`${docs.tags} @> ARRAY[${moduleTag(params.module.trim())}]::text[]`);
  }

  if (query) {
    const pattern = `%${query}%`;
    conditions.push(
      sql`(
        ${docs.title} ILIKE ${pattern}
        OR ${docs.content} ILIKE ${pattern}
        OR ${docs.externalId} ILIKE ${pattern}
      )`,
    );
  }

  const rows = await db
    .select({
      id: docs.id,
      title: docs.title,
      content: docs.content,
      status: docs.status,
      externalId: docs.externalId,
      tags: docs.tags,
    })
    .from(docs)
    .where(and(...conditions))
    .orderBy(desc(docs.updatedAt))
    .limit(limit);

  return rows;
}

export async function listFeatureDocIndex(params: {
  appId: string;
  module?: string;
  publishedOnly?: boolean;
  limit?: number;
}): Promise<Array<{ id: string; title: string; externalId: string | null; module: string | null }>> {
  const db = getDb();
  const conditions = [
    eq(docs.appId, params.appId),
    eq(docs.docType, "feature"),
    eq(docs.source, "op_sync"),
  ];

  if (params.publishedOnly) {
    conditions.push(eq(docs.status, "published"));
  }

  if (params.module?.trim()) {
    conditions.push(sql`${docs.tags} @> ARRAY[${moduleTag(params.module.trim())}]::text[]`);
  }

  const rows = await db
    .select({
      id: docs.id,
      title: docs.title,
      externalId: docs.externalId,
      tags: docs.tags,
    })
    .from(docs)
    .where(and(...conditions))
    .orderBy(docs.title)
    .limit(params.limit ?? 100);

  return rows.map((row) => {
    const moduleTagValue = row.tags?.find((t) => t.startsWith("module:"));
    return {
      id: row.id,
      title: row.title,
      externalId: row.externalId,
      module: moduleTagValue ? moduleTagValue.slice("module:".length) : null,
    };
  });
}

export async function archiveMissingFeatureDocs(
  appId: string,
  keepFeatureIds: string[],
): Promise<number> {
  const db = getDb();
  const conditions = [
    eq(docs.appId, appId),
    eq(docs.docType, "feature"),
    eq(docs.source, "op_sync"),
  ];

  if (keepFeatureIds.length > 0) {
    conditions.push(not(inArray(docs.externalId, keepFeatureIds)));
  }

  const rows = await db
    .update(docs)
    .set({ status: "archived", updatedAt: new Date() })
    .where(and(...conditions))
    .returning({ id: docs.id });

  return rows.length;
}

const MAX_CONTEXT_CHARS = 80_000;

export function buildMultiDocContext(
  docsForContext: FeatureDocSearchResult[],
  index: Array<{ id: string; title: string; externalId: string | null; module: string | null }>,
): string {
  const sections: string[] = [];
  let usedChars = 0;

  for (const doc of docsForContext) {
    const header = `### ${doc.title}${doc.externalId ? ` (${doc.externalId})` : ""}`;
    const body = doc.content?.trim() || "";
    const chunk = `${header}\n\n${body}\n`;
    if (usedChars + chunk.length > MAX_CONTEXT_CHARS) {
      const remaining = MAX_CONTEXT_CHARS - usedChars;
      if (remaining > 200) {
        sections.push(chunk.slice(0, remaining) + "\n\n[truncated]");
      }
      break;
    }
    sections.push(chunk);
    usedChars += chunk.length;
  }

  const indexLines = index
    .slice(0, 50)
    .map((item) => `- ${item.externalId || "n/a"}: ${item.title}${item.module ? ` [${item.module}]` : ""}`)
    .join("\n");

  return `## Relevant feature documentation

${sections.join("\n---\n\n")}

## Feature index (partial)
${indexLines || "_No features indexed._"}

When answering, cite the feature ID and name when possible. If the user needs full detail, suggest they open the feature doc page.`;
}
