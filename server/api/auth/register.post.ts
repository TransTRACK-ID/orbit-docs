// This endpoint receives registration data from the client, encrypts it using the server's appKey,
// and forwards the encrypted payload to the third-party API.
// The third-party API endpoint is ${process.env.NUXT_PUBLIC_API_BASE_URL}/api/v1/auth/register
// The payload format sent to the third-party API is: { "payload": "[encrypted-data]" }

import { useRuntimeConfig } from "#imports";
import crypto from "crypto";
import { createError, defineEventHandler, readBody, setCookie } from "h3";
import { $fetch } from "ofetch";
import { resolveApiBaseUrl, isPreviewMode } from "../../utils/api-url";
import { ensureTeamMember } from "~/server/utils/team-access";
import { getAuthUser } from "~/server/utils/auth";

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

    const plainText = JSON.stringify({ name, email, password, passwordConfirmation });
    const encryptedPayload = await encryptAES(plainText, appKey);

    const apiBaseUrl = resolveApiBaseUrl(config.apiBaseUrl || config.public.baseAPI);
    if (!apiBaseUrl) {
      throw createError({
        statusCode: 500,
        statusMessage: "Server Error",
        message: "API base URL not configured",
      });
    }

    // Preview mode: no external API available, return mock response
    if (isPreviewMode(config)) {
      const mockToken = 'preview-mock-token-' + Date.now();
      setCookie(event, 'session_token', mockToken, { httpOnly: true, path: '/' });

      // Auto-provision the registering user as workspace admin
      try {
        const user = await getAuthUser(event);
        await ensureTeamMember(user);
      } catch (e) {
        console.error("Failed to auto-provision team member on register (preview):", e);
      }

      return {
        status: 'success',
        data: {
          access_token: mockToken,
          user: { id: 'preview-user', email: body.email, name: 'Preview User' }
        }
      };
    }

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

    if (response.data?.access_token) {
      setCookie(event, "session_token", response.data.access_token, {
        httpOnly: true,
        path: "/",
      });
    }

    // Auto-provision the new user as a workspace admin
    try {
      const user = await getAuthUser(event);
      await ensureTeamMember(user);
    } catch (e) {
      console.error("Failed to auto-provision team member on register:", e);
    }

    return response;
  } catch (error: unknown) {
    console.error("Registration error:", error);

    const err = error as ErrorResponse;
    throw createError({
      statusCode: err.response?.status || 500,
      statusMessage: err.response?.statusText || "Internal Server Error",
      message: err.response?.data?.message || "An error occurred during registration",
    });
  }
});
