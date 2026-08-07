import { defineEventHandler, createError, getRouterParam } from "h3";
import { getDb } from "~/server/database";
import { formatAdrApiItem, getAdrById } from "~/server/lib/adr-queries";
import { requirePermission } from "~/server/utils/rbac";

export default defineEventHandler(async (event) => {
  await requirePermission(event, "adrs:read");
  const db = getDb();
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "ADR ID is required",
    });
  }

  const row = await getAdrById(db, id);
  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "ADR not found",
    });
  }

  return {
    data: formatAdrApiItem(row, { includeContent: true }),
  };
});
