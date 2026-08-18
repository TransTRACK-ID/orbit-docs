import { defineEventHandler, getQuery } from "h3";
import { getDb } from "~/server/database";
import { ensurePublicDocsAccess } from "~/server/lib/public-docs-access";
import { listPublicProducts } from "~/server/lib/public-support";

export default defineEventHandler(async (event) => {
  await ensurePublicDocsAccess(event);
  const query = getQuery(event);
  const search = typeof query.search === "string" ? query.search : "";
  const db = getDb();
  const data = await listPublicProducts(db, search);
  return { data };
});
