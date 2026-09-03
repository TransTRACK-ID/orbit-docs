import { defineEventHandler } from "h3";
import { requireSuperAdmin } from "~/server/utils/rbac";
import { getCursorApiKey } from "~/server/utils/cursor-api-key";

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);

  const dbKey = await getCursorApiKey();
  const hasEnvKey = Boolean(process.env.CURSOR_API_KEY);

  return {
    data: {
      hasApiKey: Boolean(dbKey),
      source: dbKey ? "database" : hasEnvKey ? "env" : "none",
    },
  };
});
