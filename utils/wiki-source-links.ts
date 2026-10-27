export interface WikiSourceCitation {
  raw: string; // token as written, e.g. "rally-server/features/x.go:10-40"
  path: string; // "rally-server/features/x.go"
  startLine?: number;
  endLine?: number;
}

export interface WikiSourceLinkTarget {
  url: string;
  label: string;
}

export type WikiSourceCitationResolver = (
  c: WikiSourceCitation
) => WikiSourceLinkTarget | null;

const HASH_LINE_SUFFIX = /#L(\d{1,7})(?:-L?(\d{1,7}))?$/;
const COLON_LINE_SUFFIX = /:(\d{1,7})(?:-(\d{1,7}))?$/;

export function parseWikiSourceCitation(
  token: string
): WikiSourceCitation | null {
  const raw = token.trim();
  if (!raw) return null;
  if (/\s/.test(raw)) return null;
  if (raw.includes("://")) return null;
  if (/[*?<>"'`]/.test(raw)) return null;
  if (raw.startsWith("/") || raw.startsWith("#")) return null;
  if (/^(https?:|mailto:)/i.test(raw)) return null;

  let path = raw;
  let startLine: number | undefined;
  let endLine: number | undefined;

  const hashMatch = raw.match(HASH_LINE_SUFFIX);
  const colonMatch = raw.match(COLON_LINE_SUFFIX);
  if (hashMatch) {
    path = raw.slice(0, hashMatch.index);
    startLine = Number(hashMatch[1]);
    if (hashMatch[2] !== undefined) endLine = Number(hashMatch[2]);
  } else if (colonMatch) {
    path = raw.slice(0, colonMatch.index);
    startLine = Number(colonMatch[1]);
    if (colonMatch[2] !== undefined) endLine = Number(colonMatch[2]);
  }

  // A ':' or '#' anywhere else is not a valid citation.
  if (path.includes(":") || path.includes("#")) return null;
  if (!path) return null;

  const segments = path.split("/");
  if (segments.includes("..")) return null;

  const basename = segments[segments.length - 1];
  if (!/^.+\.[A-Za-z0-9]{1,10}$/.test(basename)) return null;

  const citation: WikiSourceCitation = { raw, path };
  if (startLine !== undefined) citation.startLine = startLine;
  if (endLine !== undefined) citation.endLine = endLine;
  return citation;
}

export function linkifyWikiSourceCitations(
  markdown: string,
  resolve: WikiSourceCitationResolver
): { content: string; linked: number; unresolved: string[] } {
  let linked = 0;
  const unresolved: string[] = [];
  let inFence = false;

  const lines = markdown.split("\n").map((line) => {
    if (/^```/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    // Mask existing markdown links/images so they are never modified.
    const maskedLinks: string[] = [];
    let result = line.replace(/!?\[[^\]]*\]\([^)]*\)/g, (match) => {
      const index = maskedLinks.length;
      maskedLinks.push(match);
      return `\u0000${index}\u0000`;
    });

    // 1. Inline code span whose entire content is the token.
    result = result.replace(/`([^`\n]+)`/g, (full, token: string) => {
      const citation = parseWikiSourceCitation(token);
      if (!citation) return full;
      const target = resolve(citation);
      if (!target) {
        unresolved.push(citation.raw);
        return full;
      }
      linked++;
      return `[\`${target.label}\`](${target.url})`;
    });

    // 2. Bullet-leading plain token.
    result = result.replace(
      /^(\s*[-*]\s+)(\S+)(?=\s|$)/,
      (full, prefix: string, token: string) => {
        const citation = parseWikiSourceCitation(token);
        if (!citation) return full;
        const target = resolve(citation);
        if (!target) {
          unresolved.push(citation.raw);
          return full;
        }
        linked++;
        return `${prefix}[\`${target.label}\`](${target.url})`;
      }
    );

    // Restore masked links/images.
    result = result.replace(/\u0000(\d+)\u0000/g, (_full, index: string) => {
      return maskedLinks[Number(index)] ?? _full;
    });

    return result;
  });

  return { content: lines.join("\n"), linked, unresolved };
}

export function pruneInvalidWikiLinks(
  markdown: string,
  siteSlug: string,
  validSlugs: ReadonlySet<string>
): string {
  const escapedSiteSlug = siteSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?<!!)\\[([^\\]]*)\\]\\(\\/wiki\\/${escapedSiteSlug}\\/([^\\/\\s)]+)\\)`,
    "g"
  );
  return markdown.replace(pattern, (full, label: string, slug: string) => {
    return validSlugs.has(slug) ? full : label;
  });
}
