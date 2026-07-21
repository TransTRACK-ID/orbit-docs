import { defineEventHandler, readBody, getRouterParam, createError } from "h3";
import { getDb } from "~/server/database";
import { docSites, activityLogs } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, getActorName } from "~/server/utils/auth";
import { parseOpenApiSpec, mergeOpenApiIntoNav, OpenApiParseError } from "~/server/lib/openapi";
import { normaliseNavConfig } from "~/server/lib/nav-config";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const db = getDb();
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Site ID is required" });
  }

  const existing = await db.select().from(docSites).where(eq(docSites.id, id)).limit(1).then((r) => r[0] || null);
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Doc site not found" });
  }

  const body = await readBody(event);
  const spec = typeof body?.spec === "string" ? body.spec : "";
  const format = body?.format === "json" || body?.format === "yaml" ? body.format : undefined;

  let parsed;
  try {
    parsed = parseOpenApiSpec(spec, format);
  } catch (e: any) {
    if (e instanceof OpenApiParseError) {
      throw createError({ statusCode: 400, statusMessage: "Bad Request", message: e.message });
    }
    throw e;
  }

  const mergedNav = normaliseNavConfig(
    mergeOpenApiIntoNav(existing.navConfig as any, parsed.normalized),
  );

  const updated = await db
    .update(docSites)
    .set({
      openapiSpec: spec,
      openapiFormat: parsed.format,
      openapiNormalized: parsed.normalized,
      navConfig: mergedNav,
      updatedAt: new Date(),
    })
    .where(eq(docSites.id, id))
    .returning()
    .then((r) => r[0]);

  await db.insert(activityLogs).values({
    appId: updated.appId,
    appName: updated.name,
    action: "OpenAPI spec generated",
    actor: getActorName(user),
  });

  return {
    data: {
      format: parsed.format,
      operationsCount: parsed.normalized.operations.length,
      tags: parsed.normalized.tags,
      navConfig: mergedNav,
    },
  };
});
