import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir } from "fs/promises";
import { dirname, join } from "path";

const execAsync = promisify(exec);

export type GitProvider = "github" | "gitlab";

/**
 * Resolve the effective API host for a repository.
 * `hostUrl` wins when set (self-hosted GitLab / GitHub Enterprise).
 * Falls back to the host parsed from the repo URL, then the provider default.
 */
export function resolveApiHost(
  provider: GitProvider,
  repoUrl: string,
  hostUrl?: string | null
): string {
  if (hostUrl) {
    try {
      return new URL(hostUrl).host;
    } catch {
      return hostUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }
  }
  // Derive from the repo URL itself (handles custom domains)
  try {
    const parsed = new URL(repoUrl.replace(/^git@([^:]+):/, "https://$1/"));
    return parsed.host;
  } catch {
    return provider === "gitlab" ? "gitlab.com" : "github.com";
  }
}

export interface ParsedRepo {
  host: string;
  owner: string;
  repo: string;
  /** owner/repo */
  fullName: string;
}

/**
 * Parse an HTTPS or SSH git URL into its host/owner/repo parts.
 * Supports nested GitLab groups (owner may contain "/").
 */
export function parseRepo(repoUrl: string): ParsedRepo {
  const clean = repoUrl.trim().replace(/\.git$/, "");

  let host = "";
  let path = "";

  // SSH form: git@host:owner/repo
  const sshMatch = clean.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    host = sshMatch[1];
    path = sshMatch[2];
  } else {
    // HTTPS form: https://host/owner/repo
    try {
      const url = new URL(clean);
      host = url.host;
      path = url.pathname.replace(/^\//, "");
    } catch {
      throw new Error(`Unable to parse repository URL: ${repoUrl}`);
    }
  }

  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`Repository URL missing owner/repo: ${repoUrl}`);
  }

  const repo = parts[parts.length - 1];
  const owner = parts.slice(0, -1).join("/");

  return { host, owner, repo, fullName: `${owner}/${repo}` };
}

/**
 * Build an authenticated HTTPS clone URL embedding the access token.
 * Falls back to the original URL when no token is provided.
 * When `hostUrl` is set (self-hosted), that host is used in the returned URL.
 */
function authenticatedUrl(
  repoUrl: string,
  provider: GitProvider,
  token?: string | null,
  hostUrl?: string | null
): string {
  if (!token) return repoUrl;

  const clean = repoUrl.trim();
  let host = "";
  let path = "";

  const sshMatch = clean.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    host = sshMatch[1];
    path = sshMatch[2];
  } else {
    try {
      const url = new URL(clean);
      host = url.host;
      path = url.pathname.replace(/^\//, "");
    } catch {
      return repoUrl;
    }
  }

  // When a custom host is provided, override the host portion
  if (hostUrl) {
    try {
      host = new URL(hostUrl).host;
    } catch {
      host = hostUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }
  }

  // GitHub / GitHub Enterprise: x-access-token:<token>@host
  // GitLab / GitLab Self-Hosted: oauth2:<token>@host
  const userInfo =
    provider === "gitlab"
      ? `oauth2:${token}`
      : `x-access-token:${token}`;

  return `https://${userInfo}@${host}/${path}`;
}

/** Clone (shallow when fresh) or pull an existing repository with auth. */
export async function cloneOrPull(
  repoUrl: string,
  cloneDir: string,
  provider: GitProvider,
  token?: string | null,
  fullHistory = false,
  hostUrl?: string | null
): Promise<void> {
  const { existsSync } = await import("fs");
  const authUrl = authenticatedUrl(repoUrl, provider, token, hostUrl);

  if (existsSync(join(cloneDir, ".git"))) {
    // Make sure tags are fetched (needed for diffing between tags)
    await execAsync(
      `git -C "${cloneDir}" remote set-url origin "${authUrl}"`,
      { timeout: 60000 }
    ).catch(() => {});
    await execAsync(`git -C "${cloneDir}" fetch --all --tags --prune`, {
      timeout: 180000,
    });
    // Best-effort fast-forward of the current branch
    await execAsync(`git -C "${cloneDir}" pull --ff-only`, {
      timeout: 180000,
    }).catch(() => {});
  } else {
    await mkdir(dirname(cloneDir), { recursive: true }).catch(() => {});
    const depthFlag = fullHistory ? "" : "--depth 1";
    const { stderr } = await execAsync(
      `git clone ${depthFlag} "${authUrl}" "${cloneDir}"`,
      { timeout: 300000 }
    );
    if (stderr && /fatal:/i.test(stderr)) {
      throw new Error(`Git clone failed: ${stderr}`);
    }
    // Ensure tags available for diffing
    await execAsync(`git -C "${cloneDir}" fetch --tags`, {
      timeout: 120000,
    }).catch(() => {});
  }
}

/** Checkout a specific ref (tag or commit). */
export async function checkoutRef(
  cloneDir: string,
  ref: string
): Promise<void> {
  await execAsync(`git -C "${cloneDir}" checkout -q "${ref}"`, {
    timeout: 60000,
  });
}

export interface DiffResult {
  changedFiles: string[];
  patch: string;
}

/**
 * Compute the diff between two refs. When fromRef is null (no previous
 * processed ref) returns an empty result so the caller can fall back to a
 * full analysis.
 */
export async function diffSinceRef(
  cloneDir: string,
  fromRef: string | null,
  toRef: string,
  maxPatchChars = 60000
): Promise<DiffResult> {
  if (!fromRef) {
    return { changedFiles: [], patch: "" };
  }

  let changedFiles: string[] = [];
  try {
    const { stdout } = await execAsync(
      `git -C "${cloneDir}" diff --name-only "${fromRef}" "${toRef}"`,
      { timeout: 60000 }
    );
    changedFiles = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    // Refs may be unrelated; signal a full rebuild by returning empty
    return { changedFiles: [], patch: "" };
  }

  let patch = "";
  try {
    const { stdout } = await execAsync(
      `git -C "${cloneDir}" diff "${fromRef}" "${toRef}" -- . ':(exclude)*.lock' ':(exclude)package-lock.json' ':(exclude)pnpm-lock.yaml' ':(exclude)yarn.lock'`,
      { timeout: 120000, maxBuffer: 1024 * 1024 * 50 }
    );
    patch = stdout.length > maxPatchChars
      ? stdout.slice(0, maxPatchChars) + "\n\n... (diff truncated) ..."
      : stdout;
  } catch {
    patch = "";
  }

  return { changedFiles, patch };
}

export interface OpenPullRequestParams {
  provider: GitProvider;
  repoUrl: string;
  /** Optional custom host for self-hosted GitLab / GitHub Enterprise */
  hostUrl?: string | null;
  token: string;
  cloneDir: string;
  baseBranch: string;
  /** Relative path within the repo, e.g. docs/SDD.md */
  filePath: string;
  fileContent: string;
  branchName: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
}

/**
 * Write a file, commit it on a new branch, push, then open a PR (GitHub) or
 * MR (GitLab). Returns the PR/MR web URL.
 */
export async function openPullRequest(
  params: OpenPullRequestParams
): Promise<string> {
  const {
    provider,
    repoUrl,
    hostUrl,
    token,
    cloneDir,
    baseBranch,
    filePath,
    fileContent,
    branchName,
    commitMessage,
    prTitle,
    prBody,
  } = params;

  const { owner, repo } = parseRepo(repoUrl);
  const host = resolveApiHost(provider, repoUrl, hostUrl);
  const authUrl = authenticatedUrl(repoUrl, provider, token, hostUrl);

  // Configure a committer identity for this repo (local scope only)
  await execAsync(
    `git -C "${cloneDir}" config user.email "orbit-docs-bot@users.noreply.github.com"`,
    { timeout: 30000 }
  ).catch(() => {});
  await execAsync(
    `git -C "${cloneDir}" config user.name "Orbit Docs Bot"`,
    { timeout: 30000 }
  ).catch(() => {});

  // Start the branch from the base
  await execAsync(
    `git -C "${cloneDir}" checkout -B "${branchName}" "origin/${baseBranch}"`,
    { timeout: 60000 }
  ).catch(async () => {
    // origin/base may not exist locally on a shallow clone — create from HEAD
    await execAsync(`git -C "${cloneDir}" checkout -B "${branchName}"`, {
      timeout: 60000,
    });
  });

  // Write the file
  const absPath = join(cloneDir, filePath);
  await mkdir(dirname(absPath), { recursive: true });
  await writeFile(absPath, fileContent, "utf-8");

  // Commit
  await execAsync(`git -C "${cloneDir}" add "${filePath}"`, { timeout: 30000 });
  const escapedMsg = commitMessage.replace(/"/g, '\\"');
  const { stdout: statusOut } = await execAsync(
    `git -C "${cloneDir}" status --porcelain`,
    { timeout: 30000 }
  );
  if (!statusOut.trim()) {
    throw new Error("No changes to commit for SDD update");
  }
  await execAsync(
    `git -C "${cloneDir}" commit -m "${escapedMsg}"`,
    { timeout: 60000 }
  );

  // Push the branch
  await execAsync(
    `git -C "${cloneDir}" push -u "${authUrl}" "${branchName}" --force`,
    { timeout: 180000 }
  );

  // Open the PR / MR via REST API — `host` is already resolved (self-hosted aware)
  if (provider === "gitlab") {
    return await createGitlabMergeRequest({
      host,
      projectPath: `${owner}/${repo}`,
      token,
      sourceBranch: branchName,
      targetBranch: baseBranch,
      title: prTitle,
      description: prBody,
    });
  }

  return await createGithubPullRequest({
    host,
    owner,
    repo,
    token,
    head: branchName,
    base: baseBranch,
    title: prTitle,
    body: prBody,
  });
}

async function createGithubPullRequest(args: {
  host: string;
  owner: string;
  repo: string;
  token: string;
  head: string;
  base: string;
  title: string;
  body: string;
}): Promise<string> {
  const apiBase =
    args.host === "github.com"
      ? "https://api.github.com"
      : `https://${args.host}/api/v3`;

  const res = await fetch(
    `${apiBase}/repos/${args.owner}/${args.repo}/pulls`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: args.title,
        body: args.body,
        head: args.head,
        base: args.base,
      }),
    }
  );

  const data = (await res.json()) as { html_url?: string; message?: string };
  if (!res.ok) {
    throw new Error(
      `GitHub PR creation failed (${res.status}): ${data.message || "unknown error"}`
    );
  }
  return data.html_url || "";
}

async function createGitlabMergeRequest(args: {
  host: string;
  projectPath: string;
  token: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
}): Promise<string> {
  const apiBase = `https://${args.host}/api/v4`;
  const projectId = encodeURIComponent(args.projectPath);

  const res = await fetch(`${apiBase}/projects/${projectId}/merge_requests`, {
    method: "POST",
    headers: {
      "PRIVATE-TOKEN": args.token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_branch: args.sourceBranch,
      target_branch: args.targetBranch,
      title: args.title,
      description: args.description,
    }),
  });

  const data = (await res.json()) as { web_url?: string; message?: unknown };
  if (!res.ok) {
    throw new Error(
      `GitLab MR creation failed (${res.status}): ${JSON.stringify(data.message) || "unknown error"}`
    );
  }
  return data.web_url || "";
}
