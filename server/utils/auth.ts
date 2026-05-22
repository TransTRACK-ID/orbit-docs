import { type H3Event, getCookie, getHeader, createError } from "h3";
import { $fetch } from "ofetch";
import { useRuntimeConfig } from "#imports";

interface SessionUser {
  id: string;
  email: string;
  name?: string;
  [key: string]: any;
}

interface SessionResponse {
  status: string;
  data?: {
    user?: SessionUser;
    companies?: Array<{
      id: string;
      name: string;
      [key: string]: any;
    }>;
    [key: string]: any;
  };
  [key: string]: any;
}

interface ErrorResponse {
  response?: {
    status?: number;
    statusText?: string;
    data?: {
      message?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

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
 * Validate the session token against the third-party auth API.
 * Returns the user object when the session is valid.
 * Throws a 401 error if the session is invalid or missing.
 */
export async function getAuthUser(event: H3Event): Promise<SessionUser> {
  const token = getSessionToken(event);

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "No session token found. Please sign in.",
    });
  }

  const config = useRuntimeConfig();
  const apiBaseUrl = config.public.baseAPI;

  if (!apiBaseUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: "Server Error",
      message: "API base URL not configured",
    });
  }

  try {
    const response = await $fetch<SessionResponse>(
      `${apiBaseUrl}/api/v1/auth/session`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    const user = response.data?.user;

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized",
        message: "Invalid session token",
      });
    }

    return user;
  } catch (error: unknown) {
    const err = error as ErrorResponse;

    // Re-throw Nuxt/H3 errors directly
    if (err.statusCode || err.statusMessage) {
      throw error;
    }

    throw createError({
      statusCode: err.response?.status || 401,
      statusMessage: err.response?.statusText || "Unauthorized",
      message:
        err.response?.data?.message || "Session validation failed. Please sign in again.",
    });
  }
}

/**
 * Require an authenticated session for the current request.
 * Throws a 401 error if no valid session is present.
 * Returns the authenticated user object.
 */
export async function requireAuth(event: H3Event): Promise<SessionUser> {
  return getAuthUser(event);
}

/**
 * Get a display name for the authenticated user.
 * Falls back to email if name is not available.
 */
export function getActorName(user: SessionUser): string {
  return user.name || user.email || "Unknown";
}
