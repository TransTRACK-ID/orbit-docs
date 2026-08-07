import { defineEventHandler, readBody, createError } from "h3";
import { getDb } from "~/server/database";
import { activityLogs, docVersions, docs } from "~/server/database/schema";
import {
  defaultAdrFrontmatter,
  formatAdrApiItem,
  loadAdrTemplate,
  renderAdrTemplate,
  suggestNextAdrNumber,
} from "~/server/lib/adr-queries";
import { getActorName } from "~/server/utils/auth";
import { requirePermission } from "~/server/utils/rbac";
import { validateAdrFrontmatter } from "~/types/adr";

const VALID_STATUSES = ["draft", "in_review", "published", "archived"] as const;

export default defineEventHandler(async (event) => {
  const { user } = await requirePermission(event, "adrs:write");
  const db = getDb();
  const body = await readBody(event);

  const { title, appId, content, frontmatter, status } = body || {};

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "ADR title is required",
    });
  }

  if (!appId || typeof appId !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "appId is required for ADRs",
    });
  }

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  const adrNumber = await suggestNextAdrNumber(db, appId);
  const mergedFrontmatter = {
    ...defaultAdrFrontmatter(adrNumber),
    ...(frontmatter && typeof frontmatter === "object" ? frontmatter : {}),
  };

  const frontmatterErrors = validateAdrFrontmatter(mergedFrontmatter);
  if (frontmatterErrors.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: frontmatterErrors.map((error) => `${error.field}: ${error.message}`).join("; "),
    });
  }

  let docContent = typeof content === "string" ? content : "";
  if (!docContent.trim()) {
    const template = await loadAdrTemplate();
    docContent = renderAdrTemplate(template, {
      adrNumber: mergedFrontmatter.adr_number ?? adrNumber,
      title: title.trim(),
      adrStatus: mergedFrontmatter.adr_status,
      date: mergedFrontmatter.date,
      deciders: mergedFrontmatter.deciders,
      scope: mergedFrontmatter.scope,
    });
  }

  const doc = await db
    .insert(docs)
    .values({
      title: title.trim(),
      appId,
      content: docContent,
      frontmatter: mergedFrontmatter,
      status: status || "draft",
      source: "manual",
      docType: "adr",
      author: getActorName(user),
    })
    .returning()
    .then((rows) => rows[0]);

  await db.insert(docVersions).values({
    docId: doc.id,
    version: "v1",
    content: doc.content || "",
    title: doc.title,
    actor: getActorName(user),
  });

  await db.insert(activityLogs).values({
    appId: doc.appId,
    appName: doc.title,
    action: "ADR created",
    actor: getActorName(user),
  });

  return {
    data: formatAdrApiItem(
      {
        ...doc,
        appName: null,
        version: null,
        siteName: null,
        siteSlug: null,
        siteStatus: null,
      },
      { includeContent: true }
    ),
  };
});
