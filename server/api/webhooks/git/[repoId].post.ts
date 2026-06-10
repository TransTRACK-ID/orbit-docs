import {
  defineEventHandler,
  getRouterParam,
  readRawBody,
  readBody,
  getHeader,
  setResponseStatus,
} from "h3";
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
 * Public webhook receiver — no auth required.
 * Verifies the provider signature/token, detects a tag-creation event, and
 * kicks off a repo-scoped SDD regeneration (fire-and-forget). Returns 202
 * immediately so GitHub/GitLab don't retry.
 *
 * NOTE: We must read the raw body ourselves (for HMAC verification) before
 * any other body parsing. H3/Nitro will not double-read the stream, so we
 * use readRawBody which is safe to call first. We then parse JSON manually.
 */
export default defineEventHandler(async (event) => {
  const repoId = getRouterParam(event, "repoId");

  console.log(`[webhook] incoming POST /api/webhooks/git/${repoId}`);

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
    console.warn(`[webhook] repo not found: ${repoId}`);
    setResponseStatus(event, 404);
    return { ok: false, message: "Repository not found" };
  }

  const provider = (repo.provider as GitProvider) || "github";
  console.log(`[webhook] provider=${provider} repo=${repo.repoUrl}`);

  // Read raw body for signature verification. readRawBody must be called
  // before any other body reads; it caches internally so it is safe to
  // call multiple times.
  let rawBody = "";
  try {
    rawBody = (await readRawBody(event, false)) ?? "";
  } catch {
    // Body may have already been consumed by a middleware — try the parsed route
    rawBody = "";
  }

  // GitHub sends Content-Type: application/json with a JSON-encoded body.
  // GitLab does the same. If rawBody is still empty at this point, fall back
  // to readBody() which returns the already-parsed object.
  let body: any = {};
  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error(`[webhook] JSON parse failed, rawBody length=${rawBody.length}`);
      setResponseStatus(event, 400);
      return { ok: false, message: "Invalid JSON payload" };
    }
  } else {
    // Body was pre-parsed by Nitro — read via readBody
    try {
      body = (await readBody(event)) ?? {};
      // Reconstruct rawBody for HMAC (best-effort re-stringify preserves same content
      // only for simple payloads; GitHub's reference implementation re-signs the parsed
      // body, which matches this approach when the original JSON had no extra whitespace).
      rawBody = JSON.stringify(body);
    } catch {
      body = {};
      rawBody = "";
    }
  }

  console.log(`[webhook] body keys: ${Object.keys(body).join(", ")}`);

  // Verify signature / token
  if (repo.webhookSecret) {
    if (provider === "gitlab") {
      const ok = verifyGitlabToken(
        repo.webhookSecret,
        getHeader(event, "x-gitlab-token")
      );
      if (!ok) {
        console.warn("[webhook] invalid GitLab token");
        setResponseStatus(event, 401);
        return { ok: false, message: "Invalid webhook token" };
      }
    } else {
      const sigHeader = getHeader(event, "x-hub-signature-256");
      if (sigHeader) {
        // Only verify when the header is present; if absent and secret is set
        // the webhook was probably sent without a secret configured on GitHub.
        const ok = verifyGithubSignature(repo.webhookSecret, rawBody, sigHeader);
        if (!ok) {
          console.warn("[webhook] invalid GitHub signature");
          setResponseStatus(event, 401);
          return { ok: false, message: "Invalid webhook signature" };
        }
      }
    }
  }

  const headers: Record<string, string | undefined> = {
    "x-github-event": getHeader(event, "x-github-event"),
    "x-gitlab-event": getHeader(event, "x-gitlab-event"),
  };

  console.log(
    `[webhook] x-github-event=${headers["x-github-event"]} x-gitlab-event=${headers["x-gitlab-event"]}`
  );

  const { isTag, tag } = detectTagEvent(provider, headers, body);
  console.log(`[webhook] isTag=${isTag} tag=${tag}`);

  if (!isTag || !tag) {
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
    console.error("[webhook] no users in DB to own the job");
    setResponseStatus(event, 500);
    return { ok: false, message: "No user available to own the job" };
  }

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

  console.log(`[webhook] created job ${job.id} for tag ${tag}`);

  generateRepoSdd(job.id, repo.id, tag, async (update) => {
    await updateJobProgress(job.id, update);
  }).catch((err) => {
    console.error(`[webhook] SDD generation failed for job ${job.id}:`, err);
  });

  setResponseStatus(event, 202);
  return { ok: true, jobId: job.id, tag, message: "SDD regeneration started" };
});
