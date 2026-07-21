import { defineEventHandler, getRouterParam, createError } from "h3";
import { getDb } from "~/server/database";
import { docSites, activityLogs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, getActorName } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Site ID is required" });
  }

  const existing = await db.select().from(docSites).where(eq(docSites.id, id)).limit(1).then((r) => r[0] || null);
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Doc site not found" });
  }

  await db.delete(docSites).where(eq(docSites.id, id));

  await db.insert(activityLogs).values({
    appId: existing.appId,
    appName: existing.name,
    action: "Doc site deleted",
    actor: getActorName(user),
  });

  return { data: { id } };
});
