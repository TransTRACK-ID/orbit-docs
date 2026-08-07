import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { activityLogs, docs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { formatAdrApiItem, getAdrById } from "~/server/lib/adr-queries";
import { getActorName } from "~/server/utils/auth";
import { requirePermission } from "~/server/utils/rbac";
import { parseAdrFrontmatter } from "~/types/adr";

export default defineEventHandler(async (event) => {
  const { user } = await requirePermission(event, "adrs:write");
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "ADR ID is required",
    });
  }

  const existing = await getAdrById(db, id);
  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "ADR not found",
    });
  }

  const currentFrontmatter = parseAdrFrontmatter(existing.frontmatter ?? undefined);
  const nextFrontmatter = {
    ...(existing.frontmatter ?? {}),
    adr_status: "accepted" as const,
    date: currentFrontmatter.date || new Date().toISOString().slice(0, 10),
  };

  const updated = await db
    .update(docs)
    .set({
      frontmatter: nextFrontmatter,
      updatedAt: new Date(),
    })
    .where(eq(docs.id, id))
    .returning()
    .then((rows) => rows[0]);

  await db.insert(activityLogs).values({
    appId: updated.appId,
    appName: updated.title,
    action: "ADR accepted",
    actor: getActorName(user),
  });

  const row = await getAdrById(db, id);
  return {
    data: formatAdrApiItem(row!, { includeContent: true }),
  };
});
