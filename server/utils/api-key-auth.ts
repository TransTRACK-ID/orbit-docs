import { type H3Event, getHeader, createError } from "h3";
import { timingSafeEqual } from "crypto";
import { getDb } from "~/server/database";
import { apiKeys } from "~/server/database/schema";

const PLACEHOLDER_PATTERN = /•/;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function extractBearerToken(event: H3Event): string | undefined {
  const authHeader = getHeader(event, "authorization");
  if (!authHeader?.startsWith("Bearer ")) return undefined;
  const token = authHeader.slice(7).trim();
  return token || undefined;
}

/**
 * Require a valid workspace production API key (Settings → API Keys).
 * Used by external integrations such as OP Apps Script sync.
 */
export async function requireApiKey(event: H3Event): Promise<void> {
  const token = extractBearerToken(event);

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Missing API key. Send Authorization: Bearer <production_key>.",
    });
  }

  const db = getDb();
  const rows = await db.select().from(apiKeys).limit(1);
  const row = rows[0];

  if (!row?.productionKey || PLACEHOLDER_PATTERN.test(row.productionKey)) {
    throw createError({
      statusCode: 503,
      statusMessage: "Service Unavailable",
      message: "API key is not configured. Regenerate it in Settings → API Keys.",
    });
  }

  if (row.productionKey === "od_live_revoked" || !safeEqual(token, row.productionKey)) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Invalid API key",
    });
  }
}
