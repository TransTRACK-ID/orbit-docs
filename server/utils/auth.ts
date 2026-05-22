import { type H3Event, getCookie, getHeader, createError } from "h3";

/**
 * Extract the session token from the request.
 * Checks the httpOnly `session_token` cookie first, then falls back
 * to the `Authorization: Bearer <token>` header.
 */
export function getSessionToken(event: H3Event): string | undefined {
  let token = getCookie(event, "session_token");

  if (!token) {
    const authHeader = getHeader(event, "authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  return token;
}

/**
 * Require an authenticated session for the current request.
 * Throws a 401 error if no session token is present.
 * Returns the token string when present.
 */
export function requireAuth(event: H3Event): string {
  const token = getSessionToken(event);

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "No session token found. Please sign in.",
    });
  }

  return token;
}
