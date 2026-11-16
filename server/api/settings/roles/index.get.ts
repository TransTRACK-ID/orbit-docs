import { defineEventHandler } from "h3";
import { requireAuth } from "~/server/utils/auth";
import { loadRoles } from "~/server/utils/roles";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  return { data: await loadRoles() };
});
