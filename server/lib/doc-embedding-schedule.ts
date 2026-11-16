import { and, eq, isNull, lt, ne, or } from "drizzle-orm";
import { getDb } from "~/server/database";
import { docEmbeddingSchedule } from "~/server/database/schema/doc-embedding-schedule";
import {
  isEmbeddingConfigured,
  isSemanticSearchEnabled,
  reindexPendingAndStaleDocEmbeddings,
  type ReindexPendingAndStaleResult,
} from "~/server/lib/doc-embeddings";
import {
  getWorkspaceSyncSchedule,
  isSyncIntervalDue,
  type WorkspaceSyncSchedule,
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
  workspaceSchedule: WorkspaceSyncSchedule;
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
    hasApiKey: isEmbeddingConfigured(),
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

/**
 * A run heartbeats `updatedAt` after every doc; older than this means its
 * process died mid-run (restart/crash) and the slot can be reclaimed.
 */
export const EMBEDDING_INDEX_RUN_STALE_MS = 30 * 60 * 1000;

export interface EmbeddingIndexRun {
  /** Settles when the run ends; never rejects. Resolves true on success. */
  done: Promise<boolean>;
}

/**
 * Atomically claims the app's run slot and starts indexing in the background.
 * Returns null when indexing is disabled/unconfigured or a live run holds the slot.
 */
export async function startEmbeddingIndexRun(appId: string): Promise<EmbeddingIndexRun | null> {
  if (!isSemanticSearchEnabled() || !isEmbeddingConfigured()) {
    return null;
  }

  const db = getDb();
  const scheduleRow = await getDocEmbeddingScheduleRow(appId);
  const now = new Date();
  const claimed = await db
    .update(docEmbeddingSchedule)
    .set({
      lastRunAt: now,
      lastRunStatus: "running",
      lastRunResult: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(docEmbeddingSchedule.id, scheduleRow.id),
        or(
          ne(docEmbeddingSchedule.lastRunStatus, "running"),
          isNull(docEmbeddingSchedule.updatedAt),
          lt(
            docEmbeddingSchedule.updatedAt,
            new Date(now.getTime() - EMBEDDING_INDEX_RUN_STALE_MS),
          ),
        ),
      ),
    )
    .returning({ id: docEmbeddingSchedule.id });

  if (claimed.length === 0) {
    return null;
  }

  return {
    done: executeEmbeddingIndexRun(appId).catch((error) => {
      console.error(`[doc-embedding-schedule] app ${appId}: could not record run outcome:`, error);
      return false;
    }),
  };
}

async function executeEmbeddingIndexRun(appId: string): Promise<boolean> {
  const db = getDb();
  const startedAt = Date.now();
  // Cast keeps TS from narrowing to `null`; the closure below assigns it.
  let progress = null as ReindexPendingAndStaleResult | null;
  console.log(`[doc-embedding-schedule] app ${appId}: run started`);

  try {
    const result = await reindexPendingAndStaleDocEmbeddings(appId, async (latest) => {
      progress = latest;
      await db
        .update(docEmbeddingSchedule)
        .set({ updatedAt: new Date() })
        .where(eq(docEmbeddingSchedule.appId, appId));
    });

    await db
      .update(docEmbeddingSchedule)
      .set({
        lastRunStatus: result.failed > 0 ? "error" : "success",
        lastRunResult: { ...result, finishedAt: new Date().toISOString() },
        updatedAt: new Date(),
      })
      .where(eq(docEmbeddingSchedule.appId, appId));

    console.log(
      `[doc-embedding-schedule] app ${appId}: finished in ${Date.now() - startedAt}ms indexed=${result.indexed} failed=${result.failed} skipped=${result.skipped} candidates=${result.candidates}`,
    );
    return result.failed === 0;
  } catch (error) {
    console.error(`[doc-embedding-schedule] app ${appId} failed:`, error);
    await db
      .update(docEmbeddingSchedule)
      .set({
        lastRunStatus: "error",
        lastRunResult: progress ? { ...progress, finishedAt: new Date().toISOString() } : null,
        updatedAt: new Date(),
      })
      .where(eq(docEmbeddingSchedule.appId, appId));
    return false;
  }
}

export async function runScheduledEmbeddingIndexes(): Promise<void> {
  const workspaceSchedule = await getWorkspaceSyncSchedule();
  if (!workspaceSchedule.enabled) return;

  if (!isSemanticSearchEnabled() || !isEmbeddingConfigured()) {
    return;
  }

  const db = getDb();
  const rows = await db
    .select({
      appId: docEmbeddingSchedule.appId,
      lastRunAt: docEmbeddingSchedule.lastRunAt,
    })
    .from(docEmbeddingSchedule)
    .where(eq(docEmbeddingSchedule.scheduleEnabled, true));

  // Sequential on purpose: one app at a time keeps load on the embedding endpoint bounded.
  for (const row of rows) {
    if (!isSyncIntervalDue(row.lastRunAt, workspaceSchedule.interval)) continue;
    const run = await startEmbeddingIndexRun(row.appId);
    await run?.done;
  }
}
