import { readFileSync, statSync } from "fs";
import { isAbsolute, join } from "path";
import { buildRepoFileUrl, type GitProvider } from "./git-provider";
import type {
  WikiSourceCitation,
  WikiSourceCitationResolver,
  WikiSourceLinkTarget,
} from "~/utils/wiki-source-links";

export interface WikiRepoLinkContext {
  dirName: string; // getRepoName(repoUrl) — the clone subdir under baseDir
  cloneDir: string; // absolute path
  repo: { provider: GitProvider; repoUrl: string; hostUrl: string | null };
  ref: string; // pinned commit SHA, else branch
}

function isExistingFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function createWikiSourceCitationResolver(
  contexts: WikiRepoLinkContext[]
): WikiSourceCitationResolver {
  const lineCountCache = new Map<string, number | null>();

  function getLineCount(absolutePath: string, size: number): number | null {
    if (lineCountCache.has(absolutePath)) {
      return lineCountCache.get(absolutePath) ?? null;
    }
    let lineCount: number | null = null;
    if (size <= 1_000_000) {
      try {
        const buffer = readFileSync(absolutePath);
        const head = buffer.subarray(0, 8192);
        if (!head.includes(0)) {
          const content = buffer.toString("utf-8");
          lineCount =
            content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
        }
      } catch {
        lineCount = null;
      }
    }
    lineCountCache.set(absolutePath, lineCount);
    return lineCount;
  }

  return (citation: WikiSourceCitation): WikiSourceLinkTarget | null => {
    let context: WikiRepoLinkContext | undefined;
    let relPath: string;

    const firstSegment = citation.path.split("/")[0];
    const qualified = contexts.find((c) => c.dirName === firstSegment);
    if (qualified) {
      context = qualified;
      relPath = citation.path.slice(firstSegment.length + 1);
      if (!relPath) return null;
    } else {
      const matches = contexts.filter((c) =>
        isExistingFile(join(c.cloneDir, citation.path))
      );
      if (matches.length !== 1) return null;
      context = matches[0];
      relPath = citation.path;
    }

    if (isAbsolute(relPath)) return null;
    if (relPath.split("/").includes("..")) return null;
    if (relPath === ".git" || relPath.startsWith(".git/")) return null;

    const absolutePath = join(context.cloneDir, relPath);
    let stat;
    try {
      stat = statSync(absolutePath);
    } catch {
      return null;
    }
    if (!stat.isFile()) return null;

    let validatedStart: number | undefined;
    let validatedEnd: number | undefined;
    if (citation.startLine !== undefined) {
      const lineCount = getLineCount(absolutePath, stat.size);
      if (lineCount !== null) {
        if (citation.startLine >= 1 && citation.startLine <= lineCount) {
          validatedStart = citation.startLine;
          if (citation.endLine !== undefined) {
            const clampedEnd = Math.min(citation.endLine, lineCount);
            if (clampedEnd > citation.startLine) {
              validatedEnd = clampedEnd;
            }
          }
        }
      }
    }

    const url = buildRepoFileUrl({
      provider: context.repo.provider,
      repoUrl: context.repo.repoUrl,
      hostUrl: context.repo.hostUrl,
      ref: context.ref,
      path: relPath,
      startLine: validatedStart,
      endLine: validatedEnd,
    });
    if (!url) return null;

    const label =
      relPath +
      (validatedStart !== undefined
        ? `:${validatedStart}` +
          (validatedEnd !== undefined ? `-${validatedEnd}` : "")
        : "");

    return { url, label };
  };
}
