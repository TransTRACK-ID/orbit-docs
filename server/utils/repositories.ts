import { randomBytes } from "crypto";

/** Generate a webhook secret for a repository. */
export function generateWebhookSecret(): string {
  return "whsec_" + randomBytes(24).toString("hex");
}

/** Build the public webhook URL a developer pastes into GitHub/GitLab. */
export function buildWebhookUrl(
  proto: string | undefined,
  host: string | undefined,
  repoId: string
): string {
  const base = process.env.NUXT_PUBLIC_APP_URL || process.env.NUXT_APP_BASE_URL;
  if (base) {
    return `${base.replace(/\/$/, "")}/api/webhooks/git/${repoId}`;
  }
  if (host) {
    return `${proto || "https"}://${host}/api/webhooks/git/${repoId}`;
  }
  return `/api/webhooks/git/${repoId}`;
}

/** Mask an access token for display, keeping only the last 4 chars. */
export function redactToken(token: string | null | undefined): string | null {
  if (!token) return null;
  if (token.length <= 4) return "••••";
  return "••••" + token.slice(-4);
}
