import { defineEventHandler, getRouterParam, createError } from "h3";
import { getDb } from "~/server/database";
import { ensurePublicDocsAccess } from "~/server/lib/public-docs-access";
import { getPublicProductBySlug } from "~/server/lib/public-support";

export default defineEventHandler(async (event) => {
  await ensurePublicDocsAccess(event);
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Product slug is required" });
  }

  const db = getDb();
  const product = await getPublicProductBySlug(db, slug);
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: "Product not found" });
  }

  return { data: product };
});
