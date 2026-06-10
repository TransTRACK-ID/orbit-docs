import { defineEventHandler, createError, getRouterParam, readBody } from "h3";
import { getDb } from "~/server/database";
import { appRepositories } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/server/utils/auth";

const VALID_PROVIDERS = ["github", "gitlab"] as const;

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();
  const appId = getRouterParam(event, "id");
  const repoId = getRouterParam(event, "repoId");

  if (!appId || !repoId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID and Repository ID are required",
    });
  }

  const existing = await db
    .select()
    .from(appRepositories)
    .where(eq(appRepositories.id, repoId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing || existing.appId !== appId) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Repository not found" });
  }

  const body = await readBody(event);
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof body?.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body?.repoUrl === "string" && body.repoUrl.trim()) patch.repoUrl = body.repoUrl.trim();
  if (VALID_PROVIDERS.includes(body?.provider)) patch.provider = body.provider;
  if (typeof body?.defaultBranch === "string" && body.defaultBranch.trim())
    patch.defaultBranch = body.defaultBranch.trim();
  if (typeof body?.sddDocPath === "string" && body.sddDocPath.trim())
    patch.sddDocPath = body.sddDocPath.trim();
  // Only overwrite the token when a non-empty value is sent (avoids wiping it on edit)
  if (typeof body?.accessToken === "string" && body.accessToken.trim())
    patch.accessToken = body.accessToken.trim();
  // Allow explicit clearing of the token
  if (body?.accessToken === null) patch.accessToken = null;

  const row = await db
    .update(appRepositories)
    .set(patch)
    .where(eq(appRepositories.id, repoId))
    .returning()
    .then((rows) => rows[0]);

  return {
    data: {
      id: row.id,
      appId: row.appId,
      name: row.name,
      repoUrl: row.repoUrl,
      provider: row.provider,
      defaultBranch: row.defaultBranch,
      sddDocPath: row.sddDocPath,
      hasAccessToken: !!row.accessToken,
      lastProcessedRef: row.lastProcessedRef,
      updatedAt: row.updatedAt,
    },
  };
});
