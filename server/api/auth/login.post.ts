// Login endpoint — validates credentials against the local database.
// When an external API is configured and the app is NOT in preview mode,
// it also forwards encrypted credentials to the third-party API.

import { useRuntimeConfig } from "#imports";
import crypto from "crypto";
import { createError, defineEventHandler, readBody, setCookie } from "h3";
import { $fetch } from "ofetch";
import { resolveApiBaseUrl, isPreviewMode } from "../../utils/api-url";
import { ensureTeamMember } from "~/server/utils/team-access";
import { getAuthUser, verifyPassword } from "~/server/utils/auth";
import { getDb } from "~/server/database";
import { users } from "~/server/database/schema";
import { eq } from "drizzle-orm";

interface LoginResponse {
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
    const { email, password } = body;

    if (!email || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Missing required credentials",
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

    // External API path (only when not in preview mode and URL is configured)
    if (!isPreviewMode(config) && apiBaseUrl) {
      const plainText = JSON.stringify({ email, password });
      const encryptedPayload = await encryptAES(plainText, appKey);

      const response = await $fetch<LoginResponse>(
        `${apiBaseUrl}/api/v1/auth/login`,
        {
          method: "POST",
          body: { payload: encryptedPayload },
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      if (response.data?.access_token) {
        setCookie(event, "session_token", response.data.access_token, {
          httpOnly: true,
          path: "/",
        });
        setCookie(event, "auth.token", response.data.access_token, {
          httpOnly: false,
          path: "/",
          maxAge: 60 * 60 * 24,
        });
      }

      // Auto-provision the user as workspace admin if they don't have a member record
      try {
        const user = await getAuthUser(event);
        await ensureTeamMember(user);
      } catch (e) {
        console.error("Failed to auto-provision team member on login:", e);
      }

      return response;
    }

    // Local database path (preview mode or no external API)
    const db = getDb();

    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];

    if (!user || !verifyPassword(password, user.password)) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized",
        message: "Invalid email or password",
      });
    }

    // Use a stable token in preview mode so @sidebase/nuxt-auth can recover auth state
    const token = isPreviewMode(config) ? "preview-mock-token" : user.id;

    setCookie(event, "session_token", token, { httpOnly: true, path: "/" });
    setCookie(event, "auth.token", token, { httpOnly: false, path: "/", maxAge: 60 * 60 * 24 });

    // Auto-provision the user as workspace admin if they don't have a member record
    try {
      const authUser = await getAuthUser(event);
      await ensureTeamMember(authUser);
    } catch (e) {
      console.error("Failed to auto-provision team member on login (local):", e);
    }

    return {
      status: "success",
      data: {
        access_token: token,
        user: { id: user.id, email: user.email, name: user.name },
      },
    };
  } catch (error: unknown) {
    console.error("Login error:", error);

    const err = error as ErrorResponse;
    throw createError({
      statusCode: err.response?.status || (err as any).statusCode || 500,
      statusMessage: err.response?.statusText || (err as any).statusMessage || "Internal Server Error",
      message: err.response?.data?.message || (err as any).message || "An error occurred during login",
    });
  }
});
