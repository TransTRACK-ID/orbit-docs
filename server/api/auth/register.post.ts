// Register endpoint — creates a real local user in the database.
// When an external API is configured and the app is NOT in preview mode,
// it also forwards encrypted credentials to the third-party API.

import { useRuntimeConfig } from "#imports";
import crypto from "crypto";
import { createError, defineEventHandler, readBody, setCookie, getRequestHeader } from "h3";
import { $fetch } from "ofetch";
import { resolveApiBaseUrl, isPreviewMode, isSelfReferencingUrl } from "../../utils/api-url";
import { ensureTeamMember } from "~/server/utils/team-access";
import { hashPassword, type SessionUser } from "~/server/utils/auth";
import { getDb } from "~/server/database";
import { users } from "~/server/database/schema";
import { eq } from "drizzle-orm";

interface RegisterResponse {
  status: string;
  data?: {
    access_token: string;
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

// Encrypts plain text using AES-256-GCM
async function encryptAES(plainText: string, key: string): Promise<string> {
  if (key.length !== 32) {
    throw new Error("Encryption key must be exactly 32 bytes long");
  }

  const keyBuffer = Buffer.from(key, "utf-8");
  const nonce = crypto.randomBytes(12);
  const plainTextBuffer = Buffer.from(plainText, "utf-8");

  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, nonce);

  const encryptedBuffer = Buffer.concat([
    cipher.update(plainTextBuffer),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  const result = Buffer.concat([nonce, encryptedBuffer, authTag]);

  return result.toString("base64");
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { name, email, password, passwordConfirmation } = body;

    if (!name || !email || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Missing required fields",
      });
    }

    if (password !== passwordConfirmation) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Passwords do not match",
      });
    }

    if (password.length < 8) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Password must be at least 8 characters",
      });
    }

    const config = useRuntimeConfig();
    const appKey = config.appKey;

    if (!appKey) {
      throw createError({
        statusCode: 500,
        statusMessage: "Server Error",
        message: "Encryption key not configured",
      });
    }

    const apiBaseUrl = resolveApiBaseUrl(config.apiBaseUrl || config.public.baseAPI);
    const requestHost = getRequestHeader(event, 'host') || '';

    // External API path (only when not in preview mode, URL is configured, and not pointing to ourselves)
    if (!isPreviewMode(config) && apiBaseUrl && !isSelfReferencingUrl(apiBaseUrl, requestHost)) {
      const plainText = JSON.stringify({ name, email, password, passwordConfirmation });
      const encryptedPayload = await encryptAES(plainText, appKey);

      const response = await $fetch<RegisterResponse>(
        `${apiBaseUrl}/api/v1/auth/register`,
        {
          method: "POST",
          body: { payload: encryptedPayload },
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      // Guard against non-object responses from the external API
      if (typeof response !== 'object' || response === null || Array.isArray(response)) {
        console.error('[Register] External API returned non-object response:', response);
        throw createError({
          statusCode: 502,
          statusMessage: 'Bad Gateway',
          message: 'External authentication service returned an unexpected response format',
        });
      }

      if (response.data?.access_token) {
        setCookie(event, "session_token", response.data.access_token, {
          httpOnly: true,
          path: "/",
        });
      }

      // Auto-provision the new user as a workspace admin
      try {
        const token = response.data.access_token;
        const sessionResp = await $fetch<{
          data?: { user?: SessionUser };
        }>(
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
        const user = sessionResp.data?.user;
        if (user) {
          await ensureTeamMember(user);
        }
      } catch (e) {
        console.error("Failed to auto-provision team member on register:", e);
      }

      return response;
    }

    // Local database path (preview mode, no external API, or self-referencing URL)
    const db = getDb();

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: "Conflict",
        message: "Email is already registered",
      });
    }

    const userId = crypto.randomUUID();
    const hashedPassword = hashPassword(password);

    await db.insert(users).values({
      id: userId,
      name,
      email,
      password: hashedPassword,
    });

    setCookie(event, "session_token", userId, { httpOnly: true, path: "/" });

    // Auto-provision the registering user as workspace admin
    try {
      await ensureTeamMember({ id: userId, email, name });
    } catch (e) {
      console.error("Failed to auto-provision team member on register (local):", e);
    }

    return {
      status: "success",
      data: {
        access_token: userId,
        user: { id: userId, email, name },
      },
    };
  } catch (error: unknown) {
    console.error("Registration error:", error);

    const err = error as ErrorResponse;
    throw createError({
      statusCode: err.response?.status || (err as any).statusCode || 500,
      statusMessage: err.response?.statusText || (err as any).statusMessage || "Internal Server Error",
      message: err.response?.data?.message || (err as any).message || "An error occurred during registration",
    });
  }
});
