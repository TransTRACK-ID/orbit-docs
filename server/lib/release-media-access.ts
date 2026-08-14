import { type H3Event, createError } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { releases, workspaceSettings } from "~/server/database/schema";
import { getSessionToken } from "~/server/utils/auth";
import { getAuthContext, type AuthContext } from "~/server/utils/rbac";
import { roleHasPermission } from "~/server/lib/permissions";

export interface ReleaseMediaAccessContext {
  releaseId: string;
  published: boolean;
  auth: AuthContext | null;
}

async function getOptionalAuthContext(event: H3Event): Promise<AuthContext | null> {
  const token = getSessionToken(event);
  if (!token) return null;

  try {
    return await getAuthContext(event);
  } catch {
    return null;
  }
}

function hasReleaseReadAccess(auth: AuthContext): boolean {
  if (auth.isSuperAdmin) return true;
  if (!auth.role) return false;
  return (
    roleHasPermission(auth.role, "releases:read", auth.matrix)
    || roleHasPermission(auth.role, "releases:write", auth.matrix)
  );
}

export async function loadReleaseForMediaAccess(
  releaseId: string
): Promise<{ id: string; published: boolean } | null> {
  const db = getDb();
  const row = await db
    .select({ id: releases.id, published: releases.published })
    .from(releases)
    .where(eq(releases.id, releaseId))
    .limit(1)
    .then((rows) => rows[0]);

  return row || null;
}

export async function assertReleaseMediaAccess(
  event: H3Event,
  releaseId: string
): Promise<ReleaseMediaAccessContext> {
  const release = await loadReleaseForMediaAccess(releaseId);
  if (!release) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Release not found",
    });
  }

  const db = getDb();
  const settings = await db
    .select({ publicDocsAccess: workspaceSettings.publicDocsAccess })
    .from(workspaceSettings)
    .limit(1)
    .then((rows) => rows[0]);
  const isPublicWorkspace = settings?.publicDocsAccess ?? true;

  if (release.published && isPublicWorkspace) {
    return {
      releaseId: release.id,
      published: release.published,
      auth: await getOptionalAuthContext(event),
    };
  }

  const auth = await getOptionalAuthContext(event);
  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Authentication required to access this release media.",
    });
  }

  if (!hasReleaseReadAccess(auth)) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "Missing permission to access release media.",
    });
  }

  return {
    releaseId: release.id,
    published: release.published,
    auth,
  };
}
