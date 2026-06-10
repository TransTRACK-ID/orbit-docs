import { defineEventHandler, createError, getRouterParam, getRequestHeader } from "h3";
import { getDb } from "~/server/database";
import { appRepositories } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";
import { buildWebhookUrl, redactToken } from "~/server/utils/repositories";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const appId = getRouterParam(event, "id");

  if (!appId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID is required",
    });
  }

  const rows = await db
    .select()
    .from(appRepositories)
    .where(eq(appRepositories.appId, appId));

  const host = getRequestHeader(event, "host");
  const proto = getRequestHeader(event, "x-forwarded-proto") || "https";

  return {
    data: rows.map((r) => ({
      id: r.id,
      appId: r.appId,
      name: r.name,
      repoUrl: r.repoUrl,
      provider: r.provider,
      hostUrl: r.hostUrl,
      defaultBranch: r.defaultBranch,
      hasAccessToken: !!r.accessToken,
      accessTokenPreview: redactToken(r.accessToken),
      sddDocPath: r.sddDocPath,
      lastProcessedRef: r.lastProcessedRef,
      webhookUrl: buildWebhookUrl(proto, host, r.id),
      webhookSecret: r.webhookSecret,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  };
});
