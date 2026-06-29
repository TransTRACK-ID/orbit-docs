import { defineEventHandler, createError } from "h3";
import { requireTeamAccess, getCurrentMember } from "~/server/utils/team-access";
import { runNotionSync } from "~/server/lib/notion/sync";
import { NotionApiError } from "~/server/lib/notion/client";

export default defineEventHandler(async (event) => {
  await requireTeamAccess(event, "admin");
  await getCurrentMember(event);

  try {
    const result = await runNotionSync();
    return { data: result };
  } catch (err: any) {
    if (err instanceof NotionApiError) {
      throw createError({
        statusCode: err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 502,
        message: err.message,
      });
    }
    throw createError({
      statusCode: err?.message === "A sync is already in progress" ? 409 : 500,
      message: err?.message || "Notion sync failed",
    });
  }
});
