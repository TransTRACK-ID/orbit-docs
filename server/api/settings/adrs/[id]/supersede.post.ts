import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { activityLogs, docs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { formatAdrApiItem, getAdrById } from "~/server/lib/adr-queries";
import { getActorName } from "~/server/utils/auth";
import { requirePermission } from "~/server/utils/rbac";

export default defineEventHandler(async (event) => {
  const { user } = await requirePermission(event, "adrs:write");
  const db = getDb();
  const id = getRouterParam(event, "id");
  const body = await readBody(event);
  const replacementAdrId =
    typeof body?.replacementAdrId === "string" ? body.replacementAdrId : "";

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "ADR ID is required",
    });
  }

  if (!replacementAdrId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "replacementAdrId is required",
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

  const replacement = await getAdrById(db, replacementAdrId);
  if (!replacement) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Replacement ADR not found",
    });
  }

  if (replacement.appId !== existing.appId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Replacement ADR must belong to the same app",
    });
  }

  await db
    .update(docs)
    .set({
      frontmatter: {
        ...(existing.frontmatter ?? {}),
        adr_status: "superseded",
      },
      updatedAt: new Date(),
    })
    .where(eq(docs.id, id));

  await db
    .update(docs)
    .set({
      frontmatter: {
        ...(replacement.frontmatter ?? {}),
        supersedes: id,
      },
      updatedAt: new Date(),
    })
    .where(eq(docs.id, replacementAdrId));

  await db.insert(activityLogs).values({
    appId: existing.appId,
    appName: existing.title,
    action: `ADR superseded by ${replacement.title}`,
    actor: getActorName(user),
  });

  const row = await getAdrById(db, id);
  return {
    data: formatAdrApiItem(row!, { includeContent: true }),
    replacement: formatAdrApiItem(replacement, { includeContent: false }),
  };
});
