/**
 * Human-readable descriptions for the OAuth scopes the MCP server supports.
 * Shown on the consent screen so users know what they are approving.
 */
export const MCP_SCOPE_LABELS: Record<string, string> = {
  "mcp:read":
    "Read workspace documentation (apps, versions, docs, releases, changelogs, owners, doc sites, ADRs) visible to your account",
};

export function describeScope(scope: string): string[] {
  const scopes = scope.split(/\s+/).filter(Boolean);
  if (scopes.length === 0) return [MCP_SCOPE_LABELS["mcp:read"] as string];
  return scopes.map((s) => MCP_SCOPE_LABELS[s] ?? s);
}

export function buildClientRedirectUrl(
  redirectUri: string,
  params: Record<string, string>,
): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
