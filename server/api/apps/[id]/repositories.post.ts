import { defineEventHandler, createError, getRouterParam, readBody, getRequestHeader } from "h3";
import { getDb } from "~/server/database";
import { appRepositories, apps } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";
import { buildWebhookUrl, generateWebhookSecret } from "~/server/utils/repositories";

const VALID_PROVIDERS = ["github", "gitlab"] as const;

function normaliseHostUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const h = raw.trim();
  try {
    const url = new URL(h.startsWith("http") ? h : `https://${h}`);
    // Preserve only scheme + host (no path)
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

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

  const app = await db
    .select({ id: apps.id })
    .from(apps)
    .where(eq(apps.id, appId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!app) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "App not found" });
  }

  const body = await readBody(event);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const repoUrl = typeof body?.repoUrl === "string" ? body.repoUrl.trim() : "";
  const provider = VALID_PROVIDERS.includes(body?.provider) ? body.provider : "github";
  const hostUrl = normaliseHostUrl(body?.hostUrl);

  if (!repoUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Repository URL is required",
    });
  }

  const row = await db
    .insert(appRepositories)
    .values({
      appId,
      name: name || repoUrl.replace(/\.git$/, "").split("/").pop() || "repo",
      repoUrl,
      provider,
      hostUrl,
      defaultBranch:
        typeof body?.defaultBranch === "string" && body.defaultBranch.trim()
          ? body.defaultBranch.trim()
          : "main",
      accessToken:
        typeof body?.accessToken === "string" && body.accessToken.trim()
          ? body.accessToken.trim()
          : null,
      sddDocPath:
        typeof body?.sddDocPath === "string" && body.sddDocPath.trim()
          ? body.sddDocPath.trim()
          : "docs/SDD.md",
      autoMergeDocs: body?.autoMergeDocs === true,
      webhookSecret: generateWebhookSecret(),
    })
    .returning()
    .then((rows) => rows[0]);

  const host = getRequestHeader(event, "host");
  const proto = getRequestHeader(event, "x-forwarded-proto") || "https";

  return {
    data: {
      id: row.id,
      appId: row.appId,
      name: row.name,
      repoUrl: row.repoUrl,
      provider: row.provider,
      hostUrl: row.hostUrl,
      defaultBranch: row.defaultBranch,
      sddDocPath: row.sddDocPath,
      autoMergeDocs: row.autoMergeDocs,
      hasAccessToken: !!row.accessToken,
      webhookUrl: buildWebhookUrl(proto, host, row.id),
      webhookSecret: row.webhookSecret,
      createdAt: row.createdAt,
    },
  };
});
