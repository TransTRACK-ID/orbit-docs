import { parseRepo, resolveApiHost, type GitProvider } from "./git-provider";

export type PrMergeStatus = "open" | "merged" | "merge_failed" | "merge_skipped";

export interface AutoMergeResult {
  status: PrMergeStatus;
  errorMessage?: string;
}

export interface AutoMergeParams {
  provider: GitProvider;
  repoUrl: string;
  hostUrl?: string | null;
  token: string;
  prUrl: string;
  baseBranch: string;
  /** Squash merge by default for doc-only updates. */
  mergeMethod?: "squash" | "merge" | "rebase";
}

export function parseGithubPullNumber(prUrl: string): number | null {
  const match = prUrl.match(/\/pull\/(\d+)(?:\/|$)/);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

export function parseGitlabMergeRequestIid(prUrl: string): number | null {
  const match = prUrl.match(/\/merge_requests\/(\d+)(?:\/|$)/);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** GitHub mergeability: dirty = conflicts with base. */
export function isGithubPrConflicted(
  mergeable: boolean | null | undefined,
  mergeableState: string | null | undefined
): boolean {
  if (mergeable === false) return true;
  if (mergeableState === "dirty") return true;
  return false;
}

/** GitLab detailed merge status when conflicts exist. */
export function isGitlabMrConflicted(
  detailedMergeStatus: string | null | undefined,
  mergeStatus: string | null | undefined
): boolean {
  const detailed = (detailedMergeStatus || "").toLowerCase();
  const status = (mergeStatus || "").toLowerCase();
  if (detailed === "conflict") return true;
  if (status === "cannot_be_merged" && (detailed === "conflict" || detailed === "")) {
    return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function githubApiBase(host: string): string {
  return host === "github.com" ? "https://api.github.com" : `https://${host}/api/v3`;
}

async function fetchGithubPull(
  host: string,
  owner: string,
  repo: string,
  token: string,
  pullNumber: number
): Promise<{
  mergeable: boolean | null;
  mergeable_state: string;
  merged: boolean;
  state: string;
}> {
  const res = await fetch(
    `${githubApiBase(host)}/repos/${owner}/${repo}/pulls/${pullNumber}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  const data = (await res.json()) as {
    mergeable?: boolean | null;
    mergeable_state?: string;
    merged?: boolean;
    state?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(`GitHub PR lookup failed (${res.status}): ${data.message || "unknown error"}`);
  }
  return {
    mergeable: data.mergeable ?? null,
    mergeable_state: data.mergeable_state || "unknown",
    merged: !!data.merged,
    state: data.state || "open",
  };
}

async function waitForGithubMergeable(
  host: string,
  owner: string,
  repo: string,
  token: string,
  pullNumber: number,
  maxAttempts = 12,
  delayMs = 2500
): Promise<ReturnType<typeof fetchGithubPull>> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const pr = await fetchGithubPull(host, owner, repo, token, pullNumber);
    if (pr.merged || pr.state === "closed") return pr;
    if (pr.mergeable !== null) return pr;
    if (attempt < maxAttempts - 1) await sleep(delayMs);
  }
  return fetchGithubPull(host, owner, repo, token, pullNumber);
}

async function mergeGithubPull(
  host: string,
  owner: string,
  repo: string,
  token: string,
  pullNumber: number,
  mergeMethod: "squash" | "merge" | "rebase"
): Promise<void> {
  const res = await fetch(
    `${githubApiBase(host)}/repos/${owner}/${repo}/pulls/${pullNumber}/merge`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ merge_method: mergeMethod }),
    }
  );
  const data = (await res.json()) as { message?: string; merged?: boolean };
  if (!res.ok) {
    throw new Error(`GitHub merge failed (${res.status}): ${data.message || "unknown error"}`);
  }
  if (!data.merged) {
    throw new Error("GitHub merge failed: pull request was not merged");
  }
}

async function fetchGitlabMr(
  host: string,
  projectPath: string,
  token: string,
  iid: number
): Promise<{
  detailed_merge_status: string;
  merge_status: string;
  state: string;
}> {
  const apiBase = `https://${host}/api/v4`;
  const projectId = encodeURIComponent(projectPath);
  const res = await fetch(`${apiBase}/projects/${projectId}/merge_requests/${iid}`, {
    headers: { "PRIVATE-TOKEN": token },
  });
  const data = (await res.json()) as {
    detailed_merge_status?: string;
    merge_status?: string;
    state?: string;
    message?: unknown;
  };
  if (!res.ok) {
    throw new Error(
      `GitLab MR lookup failed (${res.status}): ${JSON.stringify(data.message) || "unknown error"}`
    );
  }
  return {
    detailed_merge_status: data.detailed_merge_status || "",
    merge_status: data.merge_status || "",
    state: data.state || "opened",
  };
}

async function waitForGitlabMergeable(
  host: string,
  projectPath: string,
  token: string,
  iid: number,
  maxAttempts = 12,
  delayMs = 2500
): Promise<ReturnType<typeof fetchGitlabMr>> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const mr = await fetchGitlabMr(host, projectPath, token, iid);
    if (mr.state === "merged" || mr.state === "closed") return mr;
    const detailed = mr.detailed_merge_status.toLowerCase();
    if (detailed && detailed !== "checking" && detailed !== "preparing") return mr;
    if (attempt < maxAttempts - 1) await sleep(delayMs);
  }
  return fetchGitlabMr(host, projectPath, token, iid);
}

async function mergeGitlabMr(
  host: string,
  projectPath: string,
  token: string,
  iid: number,
  squash: boolean
): Promise<void> {
  const apiBase = `https://${host}/api/v4`;
  const projectId = encodeURIComponent(projectPath);
  const res = await fetch(`${apiBase}/projects/${projectId}/merge_requests/${iid}/merge`, {
    method: "PUT",
    headers: {
      "PRIVATE-TOKEN": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      squash,
      should_remove_source_branch: true,
    }),
  });
  const data = (await res.json()) as { message?: unknown; state?: string };
  if (!res.ok) {
    const msg = typeof data.message === "string" ? data.message : JSON.stringify(data.message);
    throw new Error(`GitLab merge failed (${res.status}): ${msg || "unknown error"}`);
  }
}

/**
 * Attempt to merge an opened PR/MR. Skips merge when the provider reports conflicts
 * with the base branch.
 */
export async function autoMergePullRequest(params: AutoMergeParams): Promise<AutoMergeResult> {
  const { provider, repoUrl, hostUrl, token, prUrl, mergeMethod = "squash" } = params;
  const { owner, repo, fullName } = parseRepo(repoUrl);
  const host = resolveApiHost(provider, repoUrl, hostUrl);

  if (provider === "gitlab") {
    const iid = parseGitlabMergeRequestIid(prUrl);
    if (!iid) {
      return {
        status: "merge_failed",
        errorMessage: "Could not parse merge request ID from URL",
      };
    }

    const mr = await waitForGitlabMergeable(host, fullName, token, iid);
    if (mr.state === "merged") {
      return { status: "merged" };
    }
    if (mr.state === "closed") {
      return {
        status: "merge_failed",
        errorMessage: "Merge request was closed before auto-merge could run",
      };
    }

    if (isGitlabMrConflicted(mr.detailed_merge_status, mr.merge_status)) {
      return {
        status: "merge_failed",
        errorMessage:
          "Merge request has conflicts with the base branch. Resolve conflicts manually, then merge the PR.",
      };
    }

    const detailed = mr.detailed_merge_status.toLowerCase();
    if (detailed === "not_approved" || detailed === "ci_must_pass" || detailed === "discussions_not_resolved") {
      return {
        status: "open",
        errorMessage: `Auto-merge skipped: merge request is blocked (${mr.detailed_merge_status}). Merge manually after requirements are met.`,
      };
    }

    try {
      await mergeGitlabMr(host, fullName, token, iid, mergeMethod === "squash");
      return { status: "merged" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Merge failed";
      if (/conflict/i.test(msg)) {
        return {
          status: "merge_failed",
          errorMessage:
            "Merge request has conflicts with the base branch. Resolve conflicts manually, then merge the PR.",
        };
      }
      return { status: "merge_failed", errorMessage: msg };
    }
  }

  const pullNumber = parseGithubPullNumber(prUrl);
  if (!pullNumber) {
    return {
      status: "merge_failed",
      errorMessage: "Could not parse pull request number from URL",
    };
  }

  const pr = await waitForGithubMergeable(host, owner, repo, token, pullNumber);
  if (pr.merged) {
    return { status: "merged" };
  }
  if (pr.state === "closed") {
    return {
      status: "merge_failed",
      errorMessage: "Pull request was closed before auto-merge could run",
    };
  }

  if (isGithubPrConflicted(pr.mergeable, pr.mergeable_state)) {
    return {
      status: "merge_failed",
      errorMessage:
        "Pull request has conflicts with the base branch. Resolve conflicts manually, then merge the PR.",
    };
  }

  if (pr.mergeable_state === "blocked" || pr.mergeable_state === "behind") {
    return {
      status: "open",
      errorMessage: `Auto-merge skipped: pull request is ${pr.mergeable_state}. Merge manually when ready.`,
    };
  }

  if (pr.mergeable !== true) {
    return {
      status: "open",
      errorMessage: "Auto-merge skipped: mergeability could not be confirmed. Merge manually when ready.",
    };
  }

  try {
    await mergeGithubPull(host, owner, repo, token, pullNumber, mergeMethod);
    return { status: "merged" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Merge failed";
    if (/conflict|not mergeable|405/i.test(msg)) {
      return {
        status: "merge_failed",
        errorMessage:
          "Pull request has conflicts with the base branch. Resolve conflicts manually, then merge the PR.",
      };
    }
    return { status: "merge_failed", errorMessage: msg };
  }
}
