import { defineEventHandler, getQuery } from "h3";
import { getDb } from "~/server/database";
import { apps } from "~/server/database/schema";
import type { DocListView } from "~/utils/doc-display";
import { parseDocsListFilters, queryDocsListSummary } from "~/server/lib/docs-list-api";
import { requireAuth } from "~/server/utils/auth";
import { getAuthContext } from "~/server/utils/rbac";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const auth = await getAuthContext(event);
  const canReadDraftAdrs =
    auth.isSuperAdmin || auth.permissions.includes("adrs:read");
  const db = getDb();
  const query = getQuery(event);
  const filters = parseDocsListFilters(query);
  const { view: _view, ...rest } = filters;

  const viewRaw = typeof query.view === "string" ? query.view : "product";
  const activeView: DocListView =
    viewRaw === "all" || viewRaw === "product" || viewRaw === "knowledge" || viewRaw === "adrs"
      ? viewRaw
      : "product";

  const allApps = await db
    .select({ id: apps.id, name: apps.name })
    .from(apps)
    .orderBy(apps.name);

  const data = await queryDocsListSummary(
    db,
    rest,
    activeView,
    canReadDraftAdrs,
    allApps,
  );

  return { data };
});
