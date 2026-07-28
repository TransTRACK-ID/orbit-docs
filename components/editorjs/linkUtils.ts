const URL_PREFIX_RE = /^(\w+):(\/\/)?/;

/** Relative path prefixes that should be treated as internal navigation. */
const RELATIVE_PATH_RE = /^(\.\.\/|\.\/)/;

export function isBareUrl(text: string): boolean {
  const value = text.trim();
  if (!value || /\s/.test(value)) return false;

  if (URL_PREFIX_RE.test(value)) {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  const isInternal = /^\/[^/\s]/.test(value);
  const isAnchor = value.startsWith("#");
  const isProtocolRelative = /^\/\/[^/\s]/.test(value);
  const isRelativePath = RELATIVE_PATH_RE.test(value);
  if (isInternal || isAnchor || isProtocolRelative || isRelativePath) return false;

  return /^(www\.)?[\w-]+(\.[\w-]+)+([\/?#].*)?$/i.test(value);
}

export function prepareLinkUrl(link: string): string {
  let value = link.trim();
  if (URL_PREFIX_RE.test(value)) return value;

  const isInternal = /^\/[^/\s]/.test(value);
  const isAnchor = value.startsWith("#");
  const isProtocolRelative = /^\/\/[^/\s]/.test(value);
  const isRelativePath = RELATIVE_PATH_RE.test(value);
  if (!isInternal && !isAnchor && !isProtocolRelative && !isRelativePath) {
    value = `https://${value}`;
  }
  return value;
}

export function defaultLinkLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function looksLikeUrl(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (URL_PREFIX_RE.test(value)) return true;
  return /^(www\.)?[\w-]+(\.[\w-]+)/i.test(value);
}

/** Returns true for internal/relative links that should open in the same tab. */
export function isInternalLink(href: string): boolean {
  const value = href.trim();
  if (!value) return false;
  if (value.startsWith("#")) return true;
  if (value.startsWith("/")) return true;
  if (RELATIVE_PATH_RE.test(value)) return true;
  return false;
}
