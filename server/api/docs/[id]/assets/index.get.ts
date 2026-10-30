import { defineEventHandler } from "h3";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docAssets } from "~/server/database/schema";
import { requireDocAssetAccess, toDocAssetDto } from "~/server/lib/doc-assets";

export default defineEventHandler(async (event) => {
  const { doc } = await requireDocAssetAccess(event, "read");
  const db = getDb();
  const rows = await db
    .select()
    .from(docAssets)
    .where(and(eq(docAssets.docId, doc.id), eq(docAssets.status, "ready")))
    .orderBy(desc(docAssets.createdAt));

  return { data: rows.map(toDocAssetDto) };
});
