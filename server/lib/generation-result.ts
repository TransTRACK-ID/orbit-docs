import { getDb } from "~/server/database";
import {
  docGenerationJobs,
  docGenerationVersions,
  docGenerationRepoResults,
} from "~/server/database/schema";
import { eq, desc } from "drizzle-orm";

export interface GenerationResultPayload {
  jobId: string;
  appId: string;
  appName: string;
  repoUrl: string | null;
  repoRef: string | null;
  scope: string;
  status: string;
  srs: string | null;
  fsd: string | null;
  gitSnapshot: string | null;
  sdd: string | null;
  completedAt: Date | null;
  repoResults: Array<{
    id: string;
    repoId: string | null;
    repoUrl: string;
    repoRef: string | null;
    sdd: string | null;
    status: string;
    prUrl: string | null;
    prStatus: string | null;
    mergeErrorMessage: string | null;
    errorMessage: string | null;
  }>;
  versions: Array<{
    id: string;
    docType: string;
    content: string | null;
    actor: string | null;
    createdAt: Date | null;
  }>;
}

export async function loadGenerationResult(
  jobId: string,
  appName: string
): Promise<GenerationResultPayload | null> {
  const db = getDb();

  const job = await db
    .select()
    .from(docGenerationJobs)
    .where(eq(docGenerationJobs.id, jobId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!job) return null;

  const versions = await db
    .select()
    .from(docGenerationVersions)
    .where(eq(docGenerationVersions.jobId, jobId))
    .orderBy(desc(docGenerationVersions.createdAt));

  const latestVersions: Record<string, (typeof versions)[0] | undefined> = {};
  for (const v of versions) {
    if (!latestVersions[v.docType]) {
      latestVersions[v.docType] = v;
    }
  }

  const repoResults = await db
    .select()
    .from(docGenerationRepoResults)
    .where(eq(docGenerationRepoResults.jobId, jobId))
    .orderBy(desc(docGenerationRepoResults.createdAt));

  return {
    jobId: job.id,
    appId: job.appId,
    appName,
    repoUrl: job.repoUrl,
    repoRef: job.repoRef,
    scope: job.scope,
    status: job.status,
    srs: latestVersions.srs?.content ?? job.srsContent,
    fsd: latestVersions.fsd?.content ?? job.fsdContent,
    gitSnapshot: latestVersions.git_snapshot?.content ?? job.gitSnapshotContent,
    sdd: latestVersions.sdd?.content ?? job.sddContent,
    completedAt: job.completedAt,
    repoResults: repoResults.map((r) => ({
      id: r.id,
      repoId: r.repoId,
      repoUrl: r.repoUrl,
      repoRef: r.repoRef,
      sdd: r.sddContent,
      status: r.status,
      prUrl: r.prUrl,
      prStatus: r.prStatus,
      mergeErrorMessage: r.mergeErrorMessage,
      errorMessage: r.errorMessage,
    })),
    versions: versions.map((v) => ({
      id: v.id,
      docType: v.docType,
      content: v.content,
      actor: v.actor,
      createdAt: v.createdAt,
    })),
  };
}
