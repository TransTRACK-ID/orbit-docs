import { getDb } from "~/server/database";
import {
  docs,
  docVersions,
  activityLogs,
  docGenerationJobs,
  docGenerationVersions,
} from "~/server/database/schema";
import { and, desc, eq } from "drizzle-orm";

export type AppProductDocType = "srs" | "fsd" | "git_snapshot" | "sdd";
export type GenerationProductDocType = "srs" | "fsd" | "git_snapshot" | "sdd_index";

const TITLES: Record<AppProductDocType, string> = {
  srs: "Software Requirements Specification (SRS)",
  fsd: "Functional Specification Document (FSD)",
  git_snapshot: "Git Snapshot",
  sdd: "SDD Index",
};

export function generationDocTypeToAppDocType(
  type: GenerationProductDocType
): AppProductDocType {
  return type === "sdd_index" ? "sdd" : type;
}

export async function readAppProductDoc(
  appId: string,
  docType: AppProductDocType
): Promise<string | null> {
  const db = getDb();
  const row = await db
    .select({ content: docs.content })
    .from(docs)
    .where(
      and(
        eq(docs.appId, appId),
        eq(docs.docType, docType),
        eq(docs.source, "generated")
      )
    )
    .limit(1)
    .then((rows) => rows[0]);

  const content = row?.content?.trim();
  return content || null;
}

async function readLatestJobProductDoc(
  appId: string,
  docType: GenerationProductDocType,
  excludeJobId?: string
): Promise<string | null> {
  const db = getDb();
  const jobs = await db
    .select()
    .from(docGenerationJobs)
    .where(
      and(
        eq(docGenerationJobs.appId, appId),
        eq(docGenerationJobs.status, "completed"),
        eq(docGenerationJobs.scope, "product")
      )
    )
    .orderBy(desc(docGenerationJobs.completedAt))
    .limit(10);

  for (const job of jobs) {
    if (excludeJobId && job.id === excludeJobId) continue;

    const versionRow = await db
      .select({ content: docGenerationVersions.content })
      .from(docGenerationVersions)
      .where(
        and(
          eq(docGenerationVersions.jobId, job.id),
          eq(docGenerationVersions.docType, docType)
        )
      )
      .orderBy(desc(docGenerationVersions.createdAt))
      .limit(1)
      .then((rows) => rows[0]);

    const fromVersion = versionRow?.content?.trim();
    if (fromVersion) return fromVersion;

    const fromJob =
      docType === "srs"
        ? job.srsContent
        : docType === "fsd"
        ? job.fsdContent
        : docType === "git_snapshot"
        ? job.gitSnapshotContent
        : job.sddContent;

    if (fromJob?.trim()) return fromJob.trim();
  }

  return null;
}

/** Load the best existing product doc for incremental generation. */
export async function readProductDocForGeneration(
  appId: string,
  docType: GenerationProductDocType,
  options: {
    excludeJobId?: string;
    repoFallback?: () => Promise<string | null>;
  } = {}
): Promise<string | null> {
  const appDocType = generationDocTypeToAppDocType(docType);
  const fromApp = await readAppProductDoc(appId, appDocType);
  if (fromApp) return fromApp;

  const fromJob = await readLatestJobProductDoc(
    appId,
    docType,
    options.excludeJobId
  );
  if (fromJob) return fromJob;

  if (options.repoFallback) {
    return options.repoFallback();
  }

  return null;
}

export async function saveAppProductDoc(
  appId: string,
  docType: AppProductDocType,
  content: string,
  actor: string,
  title?: string
): Promise<void> {
  const db = getDb();
  const docTitle = title || TITLES[docType];
  const trimmed = content.trim();
  if (!trimmed) return;

  const existing = await db
    .select()
    .from(docs)
    .where(
      and(
        eq(docs.appId, appId),
        eq(docs.docType, docType),
        eq(docs.source, "generated")
      )
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (existing) {
    if ((existing.content || "").trim() === trimmed) return;

    const versions = await db
      .select()
      .from(docVersions)
      .where(eq(docVersions.docId, existing.id))
      .orderBy(desc(docVersions.createdAt));

    const nextVersionNum = versions.length + 1;
    await db.insert(docVersions).values({
      docId: existing.id,
      version: `v${nextVersionNum}`,
      content: existing.content || "",
      title: existing.title,
      actor,
    });

    await db
      .update(docs)
      .set({
        content: trimmed,
        title: docTitle,
        updatedAt: new Date(),
        author: actor,
      })
      .where(eq(docs.id, existing.id));

    await db.insert(activityLogs).values({
      appId,
      appName: docTitle,
      action: "Generated doc updated",
      actor,
    });
    return;
  }

  const doc = await db
    .insert(docs)
    .values({
      title: docTitle,
      appId,
      content: trimmed,
      status: "draft",
      source: "generated",
      docType,
      author: actor,
    })
    .returning()
    .then((rows) => rows[0]);

  await db.insert(docVersions).values({
    docId: doc.id,
    version: "v1",
    content: trimmed,
    title: docTitle,
    actor,
  });

  await db.insert(activityLogs).values({
    appId,
    appName: docTitle,
    action: "Generated doc created",
    actor,
  });
}
