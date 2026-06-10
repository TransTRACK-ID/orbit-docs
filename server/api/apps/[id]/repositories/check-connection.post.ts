import { defineEventHandler, createError, getRouterParam, readBody } from "h3";
import { requireAuth } from "~/server/utils/auth";
import { parseRepo, resolveApiHost, type GitProvider } from "~/server/lib/git-provider";

const VALID_PROVIDERS = ["github", "gitlab"] as const;

interface CheckConnectionBody {
  repoUrl?: string;
  provider?: string;
  hostUrl?: string | null;
  accessToken?: string | null;
}

interface ConnectionResult {
  ok: boolean;
  message: string;
  repo?: {
    name: string;
    fullName: string;
    defaultBranch?: string;
    visibility?: string;
    url?: string;
  };
}

async function checkGithubConnection(args: {
  repoUrl: string;
  hostUrl?: string | null;
  token?: string | null;
}): Promise<ConnectionResult> {
  const { repoUrl, hostUrl, token } = args;
  let parsed;
  try {
    parsed = parseRepo(repoUrl);
  } catch (e: any) {
    return { ok: false, message: e?.message || "Invalid repository URL" };
  }

  const host = resolveApiHost("github", repoUrl, hostUrl);
  const apiBase = host === "github.com" ? "https://api.github.com" : `https://${host}/api/v3`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${apiBase}/repos/${parsed.owner}/${parsed.repo}`, {
      headers,
    });

    if (res.status === 401 || res.status === 403) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      return {
        ok: false,
        message: data.message || "Authentication failed. Check your access token.",
      };
    }

    if (res.status === 404) {
      return {
        ok: false,
        message: "Repository not found. Ensure the URL is correct and you have access.",
      };
    }

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      return {
        ok: false,
        message: data.message || `GitHub API error (${res.status})`,
      };
    }

    const data = (await res.json()) as {
      name?: string;
      full_name?: string;
      default_branch?: string;
      visibility?: string;
      html_url?: string;
      private?: boolean;
    };

    return {
      ok: true,
      message: `Connected to ${data.full_name || parsed.fullName}`,
      repo: {
        name: data.name || parsed.repo,
        fullName: data.full_name || parsed.fullName,
        defaultBranch: data.default_branch,
        visibility: data.visibility || (data.private === false ? "public" : data.private === true ? "private" : undefined),
        url: data.html_url,
      },
    };
  } catch (e: any) {
    return {
      ok: false,
      message: e?.message || "Network error. Could not reach GitHub.",
    };
  }
}

async function checkGitlabConnection(args: {
  repoUrl: string;
  hostUrl?: string | null;
  token?: string | null;
}): Promise<ConnectionResult> {
  const { repoUrl, hostUrl, token } = args;
  let parsed;
  try {
    parsed = parseRepo(repoUrl);
  } catch (e: any) {
    return { ok: false, message: e?.message || "Invalid repository URL" };
  }

  const host = resolveApiHost("gitlab", repoUrl, hostUrl);
  const apiBase = `https://${host}/api/v4`;
  const projectPath = encodeURIComponent(`${parsed.owner}/${parsed.repo}`);

  const headers: Record<string, string> = {};
  if (token) {
    headers["PRIVATE-TOKEN"] = token;
  }

  try {
    const res = await fetch(`${apiBase}/projects/${projectPath}`, {
      headers,
    });

    if (res.status === 401) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      return {
        ok: false,
        message: data.message || "Authentication failed. Check your access token.",
      };
    }

    if (res.status === 403) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      return {
        ok: false,
        message: data.message || "Access denied. Your token may lack required scopes.",
      };
    }

    if (res.status === 404) {
      return {
        ok: false,
        message: `Repository not found. Ensure the URL is correct and you have access.`,
      };
    }

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      return {
        ok: false,
        message: data.message || `GitLab API error (${res.status})`,
      };
    }

    const data = (await res.json()) as {
      name?: string;
      path_with_namespace?: string;
      default_branch?: string;
      visibility?: string;
      web_url?: string;
    };

    return {
      ok: true,
      message: `Connected to ${data.path_with_namespace || parsed.fullName}`,
      repo: {
        name: data.name || parsed.repo,
        fullName: data.path_with_namespace || parsed.fullName,
        defaultBranch: data.default_branch,
        visibility: data.visibility,
        url: data.web_url,
      },
    };
  } catch (e: any) {
    return {
      ok: false,
      message: e?.message || "Network error. Could not reach GitLab.",
    };
  }
}

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const appId = getRouterParam(event, "id");

  if (!appId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "App ID is required",
    });
  }

  const body = (await readBody(event)) as CheckConnectionBody;
  const repoUrl = typeof body?.repoUrl === "string" ? body.repoUrl.trim() : "";
  const provider = VALID_PROVIDERS.includes(body?.provider as GitProvider) ? (body.provider as GitProvider) : "github";
  const hostUrl = typeof body?.hostUrl === "string" && body.hostUrl.trim() ? body.hostUrl.trim() : null;
  const accessToken = typeof body?.accessToken === "string" && body.accessToken.trim() ? body.accessToken.trim() : null;

  if (!repoUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Repository URL is required",
    });
  }

  let result: ConnectionResult;
  if (provider === "gitlab") {
    result = await checkGitlabConnection({ repoUrl, hostUrl, token: accessToken });
  } else {
    result = await checkGithubConnection({ repoUrl, hostUrl, token: accessToken });
  }

  return { data: result };
});
