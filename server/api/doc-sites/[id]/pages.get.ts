import { defineEventHandler, getRouterParam, createError } from "h3";
import { getDb } from "~/server/database";
import { docs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Site ID is required" });
  }

  const rows = await db
    .select({
      id: docs.id,
      title: docs.title,
      slug: docs.slug,
      status: docs.status,
      sortOrder: docs.sortOrder,
      frontmatter: docs.frontmatter,
      updatedAt: docs.updatedAt,
    })
    .from(docs)
    .where(eq(docs.siteId, id))
    .orderBy(docs.sortOrder, docs.updatedAt);

  return { data: rows };
});
