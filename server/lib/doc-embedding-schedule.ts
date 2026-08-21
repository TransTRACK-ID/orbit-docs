import { eq } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docEmbeddingSchedule } from "~/server/database/schema/doc-embedding-schedule";
import {
  hasEmbeddingApiKey,
  isSemanticSearchEnabled,
  reindexPendingAndStaleDocEmbeddings,
} from "~/server/lib/doc-embeddings";
import {
  getWorkspaceSyncSchedule,
  isSyncIntervalDue,
} from "~/server/lib/sync-schedule";

export interface DocEmbeddingSchedulePublic {
  scheduleEnabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string;
  lastRunResult: {
    indexed: number;
    skipped: number;
    failed: number;
    candidates: number;
    finishedAt: string;
  } | null;
  workspaceSchedule: {
    enabled: boolean;
    interval: "hourly" | "daily";
  };
  semanticSearchEnabled: boolean;
  hasApiKey: boolean;
}

export async function getDocEmbeddingScheduleRow(appId: string) {
  const db = getDb();
  let row = await db
    .select()
    .from(docEmbeddingSchedule)
    .where(eq(docEmbeddingSchedule.appId, appId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!row) {
    const inserted = await db
      .insert(docEmbeddingSchedule)
      .values({ appId })
      .returning();
    row = inserted[0];
  }

  return row;
}

export async function getDocEmbeddingSchedulePublic(
  appId: string,
): Promise<DocEmbeddingSchedulePublic> {
  const row = await getDocEmbeddingScheduleRow(appId);
  const workspaceSchedule = await getWorkspaceSyncSchedule();

  return {
    scheduleEnabled: row.scheduleEnabled,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastRunStatus: row.lastRunStatus,
    lastRunResult: row.lastRunResult ?? null,
    workspaceSchedule,
    semanticSearchEnabled: isSemanticSearchEnabled(),
    hasApiKey: hasEmbeddingApiKey(),
  };
}

export async function updateDocEmbeddingSchedule(appId: string, scheduleEnabled: boolean) {
  const db = getDb();
  const row = await getDocEmbeddingScheduleRow(appId);

  await db
    .update(docEmbeddingSchedule)
    .set({
      scheduleEnabled,
      updatedAt: new Date(),
    })
    .where(eq(docEmbeddingSchedule.id, row.id));

  return getDocEmbeddingSchedulePublic(appId);
}

export async function runScheduledEmbeddingIndexForApp(appId: string): Promise<boolean> {
  if (!isSemanticSearchEnabled() || !hasEmbeddingApiKey()) {
    return false;
  }

  const db = getDb();
  const scheduleRow = await getDocEmbeddingScheduleRow(appId);

  if (scheduleRow.lastRunStatus === "running") {
    return false;
  }

  await db
    .update(docEmbeddingSchedule)
    .set({
      lastRunAt: new Date(),
      lastRunStatus: "running",
      updatedAt: new Date(),
    })
    .where(eq(docEmbeddingSchedule.id, scheduleRow.id));

  try {
    const result = await reindexPendingAndStaleDocEmbeddings(appId);
    const lastRunResult = {
      ...result,
      finishedAt: new Date().toISOString(),
    };

    await db
      .update(docEmbeddingSchedule)
      .set({
        lastRunStatus: "success",
        lastRunResult,
        updatedAt: new Date(),
      })
      .where(eq(docEmbeddingSchedule.appId, appId));

    if (result.candidates > 0) {
      console.log(
        `[doc-embedding-schedule] app ${appId}: indexed=${result.indexed} failed=${result.failed} candidates=${result.candidates}`,
      );
    }

    return true;
  } catch (error) {
    console.error(`[doc-embedding-schedule] app ${appId} failed:`, error);
    await db
      .update(docEmbeddingSchedule)
      .set({
        lastRunStatus: "error",
        updatedAt: new Date(),
      })
      .where(eq(docEmbeddingSchedule.appId, appId));
    return false;
  }
}

export async function runScheduledEmbeddingIndexes(): Promise<void> {
  const workspaceSchedule = await getWorkspaceSyncSchedule();
  if (!workspaceSchedule.enabled) return;

  if (!isSemanticSearchEnabled() || !hasEmbeddingApiKey()) {
    return;
  }

  const db = getDb();
  const rows = await db
    .select({
      appId: docEmbeddingSchedule.appId,
      lastRunAt: docEmbeddingSchedule.lastRunAt,
      lastRunStatus: docEmbeddingSchedule.lastRunStatus,
    })
    .from(docEmbeddingSchedule)
    .where(eq(docEmbeddingSchedule.scheduleEnabled, true));

  for (const row of rows) {
    if (row.lastRunStatus === "running") continue;
    if (!isSyncIntervalDue(row.lastRunAt, workspaceSchedule.interval)) continue;
    await runScheduledEmbeddingIndexForApp(row.appId);
  }
}
