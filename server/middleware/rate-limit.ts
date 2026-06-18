import { setResponseStatus, getQuery, send } from "h3";

/**
 * Rate limiting plugin — uses Nitro middleware to intercept auth endpoints
 * before the handler runs. This is more reliable than the 'request' hook
 * because it runs inline with the request processing.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 10; // 10 attempts per window
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function getRateLimitKey(event: any): string {
  const ip = getRequestIP(event, { xForwardedFor: true }) || getRequestHeader(event, 'x-forwarded-for') || 'unknown';
  const path = event.path || '';
  return `${ip}:${path}`;
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry) {
    return false;
  }

  if (now > entry.resetAt) {
    rateLimitStore.delete(key);
    return false;
  }

  return entry.count >= MAX_REQUESTS;
}

function incrementRateLimit(key: string): void {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
  } else {
    entry.count += 1;
  }
}

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

export default defineEventHandler((event) => {
  const path = event.path || '';

  // Only rate-limit auth endpoints
  const isAuthEndpoint =
    path === '/api/auth/login' ||
    path === '/api/auth/register' ||
    path.startsWith('/api/auth/sso');

  if (!isAuthEndpoint) {
    return;
  }

  const key = getRateLimitKey(event);

  if (isRateLimited(key)) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: 'Too many login attempts. Please try again later.',
    });
  }

  incrementRateLimit(key);
});

/**
 * Reset rate limit for a given IP+path (called after successful login).
 */
export function resetRateLimit(event: any): void {
  const key = getRateLimitKey(event);
  rateLimitStore.delete(key);
}
