import { defineEventHandler, getQuery } from "h3";
import { getDb } from "~/server/database";
import { suggestNextAdrNumber } from "~/server/lib/adr-queries";
import { requirePermission } from "~/server/utils/rbac";

export default defineEventHandler(async (event) => {
  await requirePermission(event, "adrs:read");
  const db = getDb();
  const query = getQuery(event);
  const appId = typeof query.appId === "string" ? query.appId : "";

  if (!appId) {
    return { data: { nextNumber: 1 } };
  }

  const nextNumber = await suggestNextAdrNumber(db, appId);
  return { data: { nextNumber } };
});
