import { createError, getRouterParam, type H3Event } from "h3";
import { and, eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docs, docAssets, workspaceSettings } from "~/server/database/schema";
import { requireAnyPermission } from "~/server/utils/rbac";
import { requireAuth } from "~/server/utils/auth";
import { isValidUuid } from "~/server/lib/s3-storage";
import type { PermissionKey } from "~/types/permissions";

export type DocAssetRow = typeof docAssets.$inferSelect;

export interface DocAssetDto {
  id: string;
  docId: string;
  kind: "video" | "pdf";
  mimeType: string;
  sizeBytes: number;
  fileName: string;
  title: string;
  status: "pending" | "ready";
  shareEnabled: boolean;
  shareToken: string | null;
  sharedAt: Date | null;
  createdAt: Date | null;
  url: string;
}

export function docAssetFilePath(assetId: string): string {
  return `/api/doc-assets/${assetId}/file`;
}

export function docImagePath(docId: string, imageId: string): string {
  return `/api/doc-images/${docId}/${imageId}`;
}

export function toDocAssetDto(row: DocAssetRow): DocAssetDto {
  return {
    id: row.id,
    docId: row.docId,
    kind: row.kind,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    fileName: row.fileName,
    title: row.title,
    status: row.status,
    shareEnabled: row.shareEnabled,
    shareToken: row.shareEnabled ? row.shareToken : null,
    sharedAt: row.sharedAt,
    createdAt: row.createdAt,
    url: docAssetFilePath(row.id),
  };
}

async function loadDocForAssets(docId: string) {
  const db = getDb();
  const doc = await db
    .select({ id: docs.id, docType: docs.docType, status: docs.status })
    .from(docs)
    .where(eq(docs.id, docId))
    .limit(1)
    .then((rows) => rows[0]);
  if (!doc) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Doc not found" });
  }
  return doc;
}

/** Resolves `:id` and checks the caller may read (or write) the doc's attachments. */
export async function requireDocAssetAccess(event: H3Event, mode: "read" | "write") {
  const docId = getRouterParam(event, "id");
  if (!docId) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Doc ID is required" });
  }
  const doc = await loadDocForAssets(docId);
  const isAdr = doc.docType === "adr";
  const permissions: PermissionKey[] =
    mode === "write"
      ? [isAdr ? "adrs:write" : "docs:write"]
      : [isAdr ? "adrs:read" : "docs:read", "docs:write"];
  const context = await requireAnyPermission(event, permissions);
  return { doc, context };
}

export async function loadDocAssetOr404(docId: string, assetId: string | undefined): Promise<DocAssetRow> {
  if (!assetId || !isValidUuid(assetId)) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Attachment not found" });
  }
  const db = getDb();
  const row = await db
    .select()
    .from(docAssets)
    .where(and(eq(docAssets.id, assetId), eq(docAssets.docId, docId)))
    .limit(1)
    .then((rows) => rows[0]);
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Attachment not found" });
  }
  return row;
}

/** File access: published docs follow public-docs rules, everything else needs read permission. */
export async function loadDocAssetForFile(event: H3Event, assetId: string | undefined): Promise<DocAssetRow> {
  if (!assetId || !isValidUuid(assetId)) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Attachment not found" });
  }
  const db = getDb();
  const row = await db
    .select({ asset: docAssets, docStatus: docs.status, docType: docs.docType })
    .from(docAssets)
    .innerJoin(docs, eq(docs.id, docAssets.docId))
    .where(and(eq(docAssets.id, assetId), eq(docAssets.status, "ready")))
    .limit(1)
    .then((rows) => rows[0]);
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Attachment not found" });
  }

  await requireDocFileReadAccess(event, { status: row.docStatus, docType: row.docType });
  return row.asset;
}

/** Published docs follow public-docs rules; anything else needs read permission on the doc. */
export async function requireDocFileReadAccess(
  event: H3Event,
  doc: { status: string | null; docType: string | null },
): Promise<void> {
  if (doc.status === "published") {
    await requirePublicDocsAccess(event);
    return;
  }
  const isAdr = doc.docType === "adr";
  await requireAnyPermission(event, [isAdr ? "adrs:read" : "docs:read", "docs:write"]);
}

/** Loads a doc for inline image access and enforces read rules. */
export async function loadDocForImage(event: H3Event, docId: string | undefined) {
  if (!docId || !/^[a-zA-Z0-9-]+$/.test(docId)) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Image not found" });
  }
  const doc = await loadDocForAssets(docId);
  await requireDocFileReadAccess(event, doc);
  return doc;
}

/** Public endpoints honor the workspace "public docs access" switch. */
export async function requirePublicDocsAccess(event: H3Event): Promise<void> {
  const db = getDb();
  const settings = await db.select().from(workspaceSettings).limit(1).then((rows) => rows[0]);
  if (!(settings?.publicDocsAccess ?? true)) {
    await requireAuth(event);
  }
}

export async function loadSharedDocAsset(event: H3Event, token: string | undefined): Promise<DocAssetRow> {
  if (!token || !/^[a-f0-9]{40}$/.test(token)) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Shared file not found" });
  }
  await requirePublicDocsAccess(event);
  const row = await getDb()
    .select()
    .from(docAssets)
    .where(and(eq(docAssets.shareToken, token), eq(docAssets.shareEnabled, true), eq(docAssets.status, "ready")))
    .limit(1)
    .then((rows) => rows[0]);
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "Shared file not found" });
  }
  return row;
}

export function createShareToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}
