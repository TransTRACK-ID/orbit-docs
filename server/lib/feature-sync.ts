import { and, eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { apps, docs, activityLogs, docVersions } from "~/server/database/schema";
import { createDocVersionSnapshot } from "~/server/lib/doc-version-snapshot";
import {
  type FeatureRow,
  buildFeatureMarkdown,
  coerceFeatureRow,
  featureTags,
  mapFeatureStatus,
  normalizeFeatureRow,
  validateFeatureRow,
} from "~/server/lib/feature-docs";
import { archiveMissingFeatureDocs } from "~/server/lib/feature-doc-search";

export interface SyncFeatureOptions {
  archiveMissing?: boolean;
  maxBatchSize?: number;
  validateOnly?: boolean;
}

export interface SyncFeatureResultItem {
  feature_id: string;
  docId: string;
  status: string;
  publicUrl: string;
  action: "created" | "updated";
  warning?: string;
}

export interface SyncFeaturesResponse {
  created: number;
  updated: number;
  archived: number;
  errors: Array<{ feature_id?: string; message: string }>;
  results: SyncFeatureResultItem[];
}

const DEFAULT_MAX_BATCH = 200;

async function findExistingFeatureDoc(appId: string, featureId: string) {
  const db = getDb();
  return db
    .select()
    .from(docs)
    .where(
      and(
        eq(docs.appId, appId),
        eq(docs.externalId, featureId),
        eq(docs.docType, "feature"),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] || null);
}

export async function syncFeaturesToOrbit(
  appId: string,
  rawFeatures: unknown[],
  options: SyncFeatureOptions = {},
): Promise<SyncFeaturesResponse> {
  const db = getDb();
  const maxBatchSize = options.maxBatchSize ?? DEFAULT_MAX_BATCH;

  if (rawFeatures.length > maxBatchSize) {
    throw new Error(`Batch size ${rawFeatures.length} exceeds limit of ${maxBatchSize}`);
  }

  const app = await db.select({ id: apps.id }).from(apps).where(eq(apps.id, appId)).limit(1);
  if (!app[0]) {
    throw new Error("App not found");
  }

  const response: SyncFeaturesResponse = {
    created: 0,
    updated: 0,
    archived: 0,
    errors: [],
    results: [],
  };

  const seenIds = new Set<string>();
  const normalizedFeatures: FeatureRow[] = [];

  for (const raw of rawFeatures) {
    if (!raw || typeof raw !== "object") {
      response.errors.push({ message: "Feature row must be an object" });
      continue;
    }

    const coerced = coerceFeatureRow(raw as Record<string, unknown>);
    const validationError = validateFeatureRow(coerced);
    if (validationError) {
      response.errors.push(validationError);
      continue;
    }

    const feature = normalizeFeatureRow(coerced);
    if (seenIds.has(feature.feature_id)) {
      response.errors.push({
        feature_id: feature.feature_id,
        message: "Duplicate feature_id in request batch",
      });
      continue;
    }

    seenIds.add(feature.feature_id);
    normalizedFeatures.push(feature);
  }

  for (const feature of normalizedFeatures) {
    const content = buildFeatureMarkdown(feature);
    const { status, warning } = mapFeatureStatus(feature.status);
    const tags = featureTags(feature);

    if (options.validateOnly) {
      response.results.push({
        feature_id: feature.feature_id,
        docId: "",
        status,
        publicUrl: "",
        action: "created",
        warning,
      });
      continue;
    }

    const existing = await findExistingFeatureDoc(appId, feature.feature_id);

    if (existing) {
      const contentChanged = (existing.content || "") !== content;
      const statusChanged = existing.status !== status;

      if (contentChanged || statusChanged) {
        await createDocVersionSnapshot(
          db,
          existing.id,
          { title: existing.title, content: existing.content },
          feature.author,
          "save",
        );
      }

      const updated = await db
        .update(docs)
        .set({
          title: feature.feature_name,
          content,
          status,
          tags,
          author: feature.author,
          updatedAt: new Date(),
        })
        .where(eq(docs.id, existing.id))
        .returning()
        .then((rows) => rows[0]);

      await db.insert(activityLogs).values({
        appId,
        appName: feature.feature_name,
        action: "Feature doc updated (OP sync)",
        actor: feature.author,
      });

      response.updated += 1;
      response.results.push({
        feature_id: feature.feature_id,
        docId: updated.id,
        status: updated.status,
        publicUrl: `/p/${updated.id}`,
        action: "updated",
        warning,
      });
      continue;
    }

    const created = await db
      .insert(docs)
      .values({
        appId,
        title: feature.feature_name,
        content,
        status,
        tags,
        author: feature.author,
        source: "op_sync",
        docType: "feature",
        externalId: feature.feature_id,
      })
      .returning()
      .then((rows) => rows[0]);

    await db.insert(docVersions).values({
      docId: created.id,
      version: "v1",
      content: created.content || "",
      title: created.title,
      actor: feature.author,
      action: "save",
    });

    await db.insert(activityLogs).values({
      appId,
      appName: feature.feature_name,
      action: "Feature doc created (OP sync)",
      actor: feature.author,
    });

    response.created += 1;
    response.results.push({
      feature_id: feature.feature_id,
      docId: created.id,
      status: created.status,
      publicUrl: `/p/${created.id}`,
      action: "created",
      warning,
    });
  }

  if (options.archiveMissing && normalizedFeatures.length > 0) {
    response.archived = await archiveMissingFeatureDocs(
      appId,
      normalizedFeatures.map((f) => f.feature_id),
    );
  }

  return response;
}
