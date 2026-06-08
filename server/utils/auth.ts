import { type H3Event, getCookie, getHeader, createError } from "h3";
import { $fetch } from "ofetch";
import { useRuntimeConfig } from "#imports";
import { resolveApiBaseUrl, isPreviewMode } from "./api-url";
import { getDb } from "~/server/database";
import { users } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";

export interface SessionUser {
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
 * Hash a password using scrypt with a random salt.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

/**
 * Verify a password against a stored scrypt hash.
 */
export function verifyPassword(password: string, hash: string | null | undefined): boolean {
  if (!hash) return false;
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const derivedKey = scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, "hex");
  if (derivedKey.length !== keyBuffer.length) return false;
  return timingSafeEqual(derivedKey, keyBuffer);
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
 * Decode and verify a JWT token.
 */
export function verifyJwtToken(token: string, secret: string): any | null {
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

/**
 * Sign a JWT payload.
 */
export function signJwtToken(payload: any, secret: string, expiresInSeconds?: number): string {
  const options: jwt.SignOptions = {};
  if (expiresInSeconds) {
    options.expiresIn = expiresInSeconds;
  }
  return jwt.sign(payload, secret, options);
}

/**
 * Validate the session token against the local database, third-party auth API, or JWT.
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
  const apiBaseUrl = resolveApiBaseUrl(config.apiBaseUrl || config.public.baseAPI);

  // Check if token is a JWT (contains two dots)
  if (token.split(".").length === 3) {
    const jwtSecret = config.jwtSecret as string;
    if (jwtSecret) {
      const decoded = verifyJwtToken(token, jwtSecret);
      if (decoded && decoded.email) {
        return {
          id: decoded.sub || decoded.email,
          email: decoded.email,
          name: decoded.name,
        };
      }
    }
  }

  // In preview mode (or when no external API is configured), validate against local DB
  if (isPreviewMode(config) || !apiBaseUrl) {
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.id, token)).limit(1);
    const user = rows[0];

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized",
        message: "Invalid session token",
      });
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
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
