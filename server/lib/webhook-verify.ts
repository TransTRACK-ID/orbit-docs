import { createHmac, timingSafeEqual } from "crypto";
import type { GitProvider } from "./git-provider";

export interface TagEvent {
  isTag: boolean;
  /** The tag name, e.g. v1.2.3 */
  tag: string | null;
}

/**
 * Verify a GitHub webhook signature (X-Hub-Signature-256: sha256=...).
 * `rawBody` must be the exact bytes received.
 */
export function verifyGithubSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | undefined
): boolean {
  if (!signatureHeader) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Verify a GitLab webhook token (X-Gitlab-Token), compared in constant time.
 */
export function verifyGitlabToken(
  secret: string,
  tokenHeader: string | undefined
): boolean {
  if (!tokenHeader) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(tokenHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Determine whether an incoming webhook represents a tag creation, and
 * extract the tag name. Supports GitHub ("create" + push to refs/tags) and
 * GitLab ("Tag Push Hook").
 */
export function detectTagEvent(
  provider: GitProvider,
  headers: Record<string, string | undefined>,
  body: any
): TagEvent {
  if (provider === "gitlab") {
    const eventName =
      body?.object_kind || headers["x-gitlab-event"];
    const isTagPush =
      eventName === "tag_push" ||
      headers["x-gitlab-event"] === "Tag Push Hook";
    if (isTagPush) {
      const ref: string = body?.ref || "";
      const tag = ref.replace(/^refs\/tags\//, "") || null;
      // Ignore tag deletions (after = all zeros)
      const after: string = body?.after || "";
      if (after && /^0+$/.test(after)) return { isTag: false, tag: null };
      return { isTag: !!tag, tag };
    }
    return { isTag: false, tag: null };
  }

  // GitHub
  const ghEvent = headers["x-github-event"];

  // "create" event with ref_type=tag
  if (ghEvent === "create" && body?.ref_type === "tag") {
    return { isTag: true, tag: body?.ref || null };
  }

  // "push" event to a tag ref
  if (ghEvent === "push") {
    const ref: string = body?.ref || "";
    if (ref.startsWith("refs/tags/")) {
      const deleted = body?.deleted === true;
      if (deleted) return { isTag: false, tag: null };
      return { isTag: true, tag: ref.replace(/^refs\/tags\//, "") };
    }
  }

  return { isTag: false, tag: null };
}
