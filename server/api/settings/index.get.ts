import { defineEventHandler, createError } from "h3";
import { getDb } from "~/server/database";
import { workspaceSettings } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();

  let rows = await db.select().from(workspaceSettings).limit(1);
  let row = rows[0];

  if (!row) {
    const inserted = await db.insert(workspaceSettings).values({
      id: crypto.randomUUID(),
      name: "Acme Engineering",
      slug: "acme-engineering",
      description: "Internal documentation platform for product and engineering teams.",
      theme: "light",
      logoUrl: null,
      publicDocsAccess: true,
    }).returning();
    row = inserted[0];
  }

  return { data: row };
});
