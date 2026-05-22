// This endpoint receives login credentials from the client, encrypts them using the server's appKey,
// and forwards the encrypted payload to the third-party API
// The third-party API endpoint is ${process.env.NUXT_PUBLIC_API_BASE_URL}/api/v1/auth/login
// The payload format sent to the third-party API is: { "payload": "[encrypted-data]" }

import { useRuntimeConfig } from "#imports";
import crypto from "crypto";
import { createError, defineEventHandler, readBody, setCookie } from "h3";
import { $fetch } from "ofetch";
import { resolveApiBaseUrl } from "../../utils/api-url";

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

  // Create cipher
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, nonce);

  // Encrypt the data
  const encryptedBuffer = Buffer.concat([
    cipher.update(plainTextBuffer),
    cipher.final(),
  ]);

  // Get the auth tag
  const authTag = cipher.getAuthTag();

  // Combine nonce, encrypted data, and auth tag
  const result = Buffer.concat([nonce, encryptedBuffer, authTag]);

  // Return as base64
  return result.toString("base64");
}

export default defineEventHandler(async (event) => {
  try {
    // Get the login credentials from the request body
    const body = await readBody(event);
    const { email, password } = body;

    if (!email || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Missing required credentials",
      });
    }

    // Get the appKey from runtime config
    const config = useRuntimeConfig();
    const appKey = config.appKey;

    if (!appKey) {
      throw createError({
        statusCode: 500,
        statusMessage: "Server Error",
        message: "Encryption key not configured",
      });
    }

    // Create the plain text JSON with email and password
    const plainText = JSON.stringify({ email, password });

    // Encrypt the plain text
    const encryptedPayload = await encryptAES(plainText, appKey);

    // Server-only base URL — can be absolute in preview mode so $fetch works
    const apiBaseUrl = resolveApiBaseUrl(config.apiBaseUrl || config.public.baseAPI);

    if (!apiBaseUrl) {
      throw createError({
        statusCode: 500,
        statusMessage: "Server Error",
        message: "API base URL not configured",
      });
    }

    // Preview mode: no external API available, return mock response
    if (apiBaseUrl.includes('127.0.0.1') || apiBaseUrl.includes('localhost')) {
      const mockToken = 'preview-mock-token-' + Date.now();
      setCookie(event, 'session_token', mockToken, { httpOnly: true, path: '/' });
      return {
        status: 'success',
        data: {
          access_token: mockToken,
          user: { id: 'preview-user', email: body.email, name: 'Preview User' }
        }
      };
    }

    // Make the request to the third-party API
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

    // If we get here, the login was successful
    // Set any necessary cookies based on the response

    if (response.data?.access_token) {
      setCookie(event, "session_token", response.data.access_token, {
        httpOnly: true,
        path: "/",
      });
    }

    // Return the response from the third-party API
    return response;
  } catch (error: unknown) {
    // Handle errors from the third-party API
    console.error("Login error:", error);

    // Forward the error status and message
    const err = error as ErrorResponse;
    throw createError({
      statusCode: err.response?.status || 500,
      statusMessage: err.response?.statusText || "Internal Server Error",
      message: err.response?.data?.message || "An error occurred during login",
    });
  }
});
