const LOGO_PROXY_RE =
  /\/api\/public\/brand\/logos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i;

/** Return a canonical logo proxy path, or null when the URL is not a valid brand logo asset. */
export function sanitizeBrandLogoUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const match = trimmed.match(LOGO_PROXY_RE);
  if (!match?.[1]) return null;

  return `/api/public/brand/logos/${match[1].toLowerCase()}`;
}