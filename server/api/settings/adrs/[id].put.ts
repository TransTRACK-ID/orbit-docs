import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { activityLogs, docs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { formatAdrApiItem, getAdrById } from "~/server/lib/adr-queries";
import { createDocVersionSnapshot, isValidDocVersionAction } from "~/server/lib/doc-version-snapshot";
import { getActorName } from "~/server/utils/auth";
import { requirePermission } from "~/server/utils/rbac";
import { validateAdrFrontmatter } from "~/types/adr";

const VALID_STATUSES = ["draft", "in_review", "published", "archived"] as const;

export default defineEventHandler(async (event) => {
  const { user, permissions } = await requirePermission(event, "adrs:write");
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

  const body = await readBody(event);
  const { title, content, status, frontmatter, versionAction } = body || {};

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  const nextStatus = status ?? existing.status;
  const statusChanging =
    status !== undefined && status !== existing.status;
  const publishingOrArchiving =
    statusChanging && (nextStatus === "published" || nextStatus === "archived");

  if (publishingOrArchiving && !permissions.includes("adrs:publish")) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "Missing permission: adrs:publish",
    });
  }

  const mergedFrontmatter = {
    ...(existing.frontmatter ?? {}),
    ...(frontmatter && typeof frontmatter === "object" ? frontmatter : {}),
  };

  const frontmatterErrors = validateAdrFrontmatter(mergedFrontmatter);
  if (frontmatterErrors.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: frontmatterErrors.map((error) => `${error.field}: ${error.message}`).join("; "),
    });
  }

  if (isValidDocVersionAction(versionAction)) {
    await createDocVersionSnapshot(
      db,
      id,
      { title: existing.title, content: existing.content },
      getActorName(user),
      versionAction
    );
  }

  const updateData: Partial<typeof docs.$inferInsert> = {
    updatedAt: new Date(),
    frontmatter: mergedFrontmatter,
  };

  if (title !== undefined) updateData.title = title.trim();
  if (content !== undefined) updateData.content = content || "";
  if (status !== undefined) updateData.status = status;

  const updated = await db
    .update(docs)
    .set(updateData)
    .where(eq(docs.id, id))
    .returning()
    .then((rows) => rows[0]);

  await db.insert(activityLogs).values({
    appId: updated.appId,
    appName: updated.title,
    action: "ADR updated",
    actor: getActorName(user),
  });

  const row = await getAdrById(db, id);
  return {
    data: formatAdrApiItem(row!, { includeContent: true }),
  };
});
