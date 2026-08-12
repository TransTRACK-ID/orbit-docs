import { and, eq, notInArray } from "drizzle-orm";
import { getDb } from "~/server/database";
import {
  apps,
  appRepositories,
  docGenerationJobs,
  docGenerationSchedule,
  users,
} from "~/server/database/schema";
import { generateProductDocs, updateJobProgress } from "~/server/lib/doc-generator";
import { assertDocAgentReady } from "~/server/lib/agent-readiness";
import {
  getWorkspaceSyncSchedule,
  isSyncIntervalDue,
} from "~/server/lib/sync-schedule";

const TERMINAL_JOB_STATUSES = ["completed", "failed", "cancelled"] as const;

export interface DocGenerationSchedulePublic {
  scheduleEnabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string;
  lastRunJobId: string | null;
  workspaceSchedule: {
    enabled: boolean;
    interval: "hourly" | "daily";
  };
}

export async function getDocGenerationScheduleRow(appId: string) {
  const db = getDb();
  let row = await db
    .select()
    .from(docGenerationSchedule)
    .where(eq(docGenerationSchedule.appId, appId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!row) {
    const inserted = await db
      .insert(docGenerationSchedule)
      .values({ appId })
      .returning();
    row = inserted[0];
  }

  return row;
}

export async function getDocGenerationSchedulePublic(
  appId: string
): Promise<DocGenerationSchedulePublic> {
  const row = await getDocGenerationScheduleRow(appId);
  const workspaceSchedule = await getWorkspaceSyncSchedule();

  return {
    scheduleEnabled: row.scheduleEnabled,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastRunStatus: row.lastRunStatus,
    lastRunJobId: row.lastRunJobId,
    workspaceSchedule,
  };
}

export async function updateDocGenerationSchedule(
  appId: string,
  scheduleEnabled: boolean
) {
  const db = getDb();
  const row = await getDocGenerationScheduleRow(appId);

  const [updated] = await db
    .update(docGenerationSchedule)
    .set({
      scheduleEnabled,
      updatedAt: new Date(),
    })
    .where(eq(docGenerationSchedule.id, row.id))
    .returning();

  return getDocGenerationSchedulePublic(appId).then((publicRow) => ({
    ...publicRow,
    scheduleEnabled: updated.scheduleEnabled,
  }));
}

async function appHasRepositories(appId: string, legacyRepoUrl: string | null) {
  const db = getDb();
  const repos = await db
    .select({ id: appRepositories.id })
    .from(appRepositories)
    .where(eq(appRepositories.appId, appId));
  return repos.length > 0 || !!legacyRepoUrl;
}

async function hasPendingProductJob(appId: string) {
  const db = getDb();
  const pending = await db
    .select({ id: docGenerationJobs.id })
    .from(docGenerationJobs)
    .where(
      and(
        eq(docGenerationJobs.appId, appId),
        eq(docGenerationJobs.scope, "product"),
        notInArray(docGenerationJobs.status, [...TERMINAL_JOB_STATUSES])
      )
    )
    .limit(1)
    .then((rows) => rows[0]);
  return !!pending;
}

async function resolveScheduleActorUserId() {
  const db = getDb();
  const actor = await db
    .select({ id: users.id })
    .from(users)
    .limit(1)
    .then((rows) => rows[0]);
  return actor?.id ?? null;
}

export async function startScheduledProductDocGeneration(appId: string): Promise<string | null> {
  const db = getDb();

  const app = await db
    .select({ id: apps.id, repoUrl: apps.repoUrl })
    .from(apps)
    .where(eq(apps.id, appId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!app) return null;

  const hasRepos = await appHasRepositories(appId, app.repoUrl);
  if (!hasRepos) return null;

  if (await hasPendingProductJob(appId)) return null;

  const actorId = await resolveScheduleActorUserId();
  if (!actorId) return null;

  const scheduleRow = await getDocGenerationScheduleRow(appId);

  const job = await db
    .insert(docGenerationJobs)
    .values({
      appId,
      userId: actorId,
      repoUrl: app.repoUrl ?? null,
      scope: "product",
      trigger: "scheduled",
      status: "cloning",
      progressPct: 0,
      progressMessage: "Scheduled sync starting...",
    })
    .returning()
    .then((rows) => rows[0]);

  await db
    .update(docGenerationSchedule)
    .set({
      lastRunAt: new Date(),
      lastRunStatus: "running",
      lastRunJobId: job.id,
      updatedAt: new Date(),
    })
    .where(eq(docGenerationSchedule.id, scheduleRow.id));

  generateProductDocs(job.id, appId, async (update) => {
    await updateJobProgress(job.id, update);
  })
    .then(async () => {
      await db
        .update(docGenerationSchedule)
        .set({
          lastRunStatus: "success",
          updatedAt: new Date(),
        })
        .where(eq(docGenerationSchedule.appId, appId));
    })
    .catch(async (error) => {
      console.error(`Scheduled doc generation failed for app ${appId}:`, error);
      await db
        .update(docGenerationSchedule)
        .set({
          lastRunStatus: "error",
          updatedAt: new Date(),
        })
        .where(eq(docGenerationSchedule.appId, appId));
    });

  return job.id;
}

export async function runScheduledDocGenerations(): Promise<void> {
  const workspaceSchedule = await getWorkspaceSyncSchedule();
  if (!workspaceSchedule.enabled) return;

  try {
    await assertDocAgentReady();
  } catch (error: unknown) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message?: string }).message)
        : "Doc generation agent is not configured";
    console.warn("[doc-generation-schedule]", message);
    return;
  }

  const db = getDb();
  const rows = await db
    .select({
      appId: docGenerationSchedule.appId,
      lastRunAt: docGenerationSchedule.lastRunAt,
      lastRunStatus: docGenerationSchedule.lastRunStatus,
    })
    .from(docGenerationSchedule)
    .where(eq(docGenerationSchedule.scheduleEnabled, true));

  for (const row of rows) {
    if (row.lastRunStatus === "running") {
      const stillRunning = await hasPendingProductJob(row.appId);
      if (stillRunning) continue;
      await db
        .update(docGenerationSchedule)
        .set({ lastRunStatus: "idle", updatedAt: new Date() })
        .where(eq(docGenerationSchedule.appId, row.appId));
    }
    if (!isSyncIntervalDue(row.lastRunAt, workspaceSchedule.interval)) continue;
    await startScheduledProductDocGeneration(row.appId);
  }
}
