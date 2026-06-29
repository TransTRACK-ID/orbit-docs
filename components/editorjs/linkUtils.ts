const URL_PREFIX_RE = /^(\w+):(\/\/)?/;

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
  if (isInternal || isAnchor || isProtocolRelative) return false;

  return /^(www\.)?[\w-]+(\.[\w-]+)+([\/?#].*)?$/i.test(value);
}

export function prepareLinkUrl(link: string): string {
  let value = link.trim();
  if (URL_PREFIX_RE.test(value)) return value;

  const isInternal = /^\/[^/\s]/.test(value);
  const isAnchor = value.startsWith("#");
  const isProtocolRelative = /^\/\/[^/\s]/.test(value);
  if (!isInternal && !isAnchor && !isProtocolRelative) {
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
