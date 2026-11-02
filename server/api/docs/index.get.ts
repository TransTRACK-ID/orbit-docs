import { defineEventHandler, getQuery } from "h3";
import { getDb } from "~/server/database";
import {
  parseDocsListFilters,
  parseDocsListPagination,
  queryDocsList,
} from "~/server/lib/docs-list-api";
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
  const pagination = parseDocsListPagination(query);

  const result = await queryDocsList(db, filters, pagination, canReadDraftAdrs);

  return result;
});
