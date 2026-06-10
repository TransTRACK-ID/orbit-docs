import { defineEventHandler, getRouterParam, readRawBody, getHeader, setResponseStatus } from "h3";
import { getDb } from "~/server/database";
import { appRepositories, docGenerationJobs, users } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import {
  verifyGithubSignature,
  verifyGitlabToken,
  detectTagEvent,
} from "~/server/lib/webhook-verify";
import { generateRepoSdd, updateJobProgress } from "~/server/lib/doc-generator";
import type { GitProvider } from "~/server/lib/git-provider";

/**
 * Public webhook receiver. Verifies the signature, detects a tag-creation
 * event, and kicks off a repo-scoped SDD regeneration. Responds 202 quickly;
 * generation runs in the background.
 */
export default defineEventHandler(async (event) => {
  const repoId = getRouterParam(event, "repoId");
  const db = getDb();

  const repo = repoId
    ? await db
        .select()
        .from(appRepositories)
        .where(eq(appRepositories.id, repoId))
        .limit(1)
        .then((rows) => rows[0])
    : undefined;

  if (!repo) {
    setResponseStatus(event, 404);
    return { ok: false, message: "Repository not found" };
  }

  const provider = (repo.provider as GitProvider) || "github";
  const rawBody = (await readRawBody(event)) || "";

  // Verify signature / token
  if (repo.webhookSecret) {
    if (provider === "gitlab") {
      const ok = verifyGitlabToken(
        repo.webhookSecret,
        getHeader(event, "x-gitlab-token")
      );
      if (!ok) {
        setResponseStatus(event, 401);
        return { ok: false, message: "Invalid webhook token" };
      }
    } else {
      const ok = verifyGithubSignature(
        repo.webhookSecret,
        rawBody,
        getHeader(event, "x-hub-signature-256")
      );
      if (!ok) {
        setResponseStatus(event, 401);
        return { ok: false, message: "Invalid webhook signature" };
      }
    }
  }

  let body: any = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    setResponseStatus(event, 400);
    return { ok: false, message: "Invalid JSON payload" };
  }

  const headers: Record<string, string | undefined> = {
    "x-github-event": getHeader(event, "x-github-event"),
    "x-gitlab-event": getHeader(event, "x-gitlab-event"),
  };

  const { isTag, tag } = detectTagEvent(provider, headers, body);

  if (!isTag || !tag) {
    // Acknowledge non-tag events (ping, pushes to branches, etc.) without work
    setResponseStatus(event, 202);
    return { ok: true, message: "Ignored: not a tag-creation event" };
  }

  // Resolve a user to attribute the job to (jobs.userId is NOT NULL)
  const actor = await db
    .select({ id: users.id })
    .from(users)
    .limit(1)
    .then((rows) => rows[0]);

  if (!actor) {
    setResponseStatus(event, 500);
    return { ok: false, message: "No user available to own the job" };
  }

  // Create a repo-scoped job
  const job = await db
    .insert(docGenerationJobs)
    .values({
      appId: repo.appId,
      userId: actor.id,
      repoUrl: repo.repoUrl,
      repoId: repo.id,
      scope: "repo",
      trigger: "webhook",
      status: "cloning",
      progressPct: 0,
      progressMessage: `Tag ${tag} received`,
      repoRef: tag,
    })
    .returning()
    .then((rows) => rows[0]);

  // Fire-and-forget background generation
  generateRepoSdd(job.id, repo.id, tag, async (update) => {
    await updateJobProgress(job.id, update);
  }).catch((err) => {
    console.error(`Webhook SDD generation failed for job ${job.id}:`, err);
  });

  setResponseStatus(event, 202);
  return { ok: true, jobId: job.id, tag, message: "SDD regeneration started" };
});
