import { defineEventHandler, getQuery } from "h3";
import { getDb } from "~/server/database";
import {
  formatAdrApiItem,
  formatAdrConstraintSummary,
  listAdrs,
} from "~/server/lib/adr-queries";
import { requirePermission } from "~/server/utils/rbac";
import type { AdrStatus } from "~/types/adr";
import { ADR_STATUSES } from "~/types/adr";

export default defineEventHandler(async (event) => {
  await requirePermission(event, "adrs:read");
  const db = getDb();
  const query = getQuery(event);

  const appId = typeof query.appId === "string" ? query.appId : undefined;
  const adrStatus =
    typeof query.adrStatus === "string" && ADR_STATUSES.includes(query.adrStatus as AdrStatus)
      ? (query.adrStatus as AdrStatus)
      : undefined;
  const bindingOnly = query.bindingOnly === "true" || query.bindingOnly === true;
  const scope = typeof query.scope === "string" ? query.scope : undefined;
  const includeContent = query.includeContent !== "false";

  const rows = await listAdrs(db, {
    appId,
    adrStatus,
    bindingOnly,
    scope,
    includeContent,
  });

  const bindingRows = rows.filter(
    (row) => row.status === "published" && row.frontmatter?.adr_status === "accepted"
  );

  return {
    data: rows.map((row) => formatAdrApiItem(row, { includeContent })),
    bindingCount: bindingRows.length,
    constraintSummary: formatAdrConstraintSummary(bindingRows),
  };
});
