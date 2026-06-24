// Session endpoint — validates the session token against the local database
// or forwards it to the third-party auth API when configured.

import { defineEventHandler, getCookie, getHeader, createError, getRequestHeader } from "h3";
import { $fetch } from "ofetch";
import { resolveApiBaseUrl, isPreviewMode, isSelfReferencingUrl } from "../../utils/api-url";
import {
  getJwtSecret,
  isRuntimePreviewMode,
  resolveConfiguredApiBaseUrl,
} from "~/server/utils/runtime-env";
import { getDb } from "~/server/database";
import { users } from "~/server/database/schema";
import { eq } from "drizzle-orm";
import { verifyJwtToken } from "~/server/utils/auth";

interface SessionResponse {
    status: string;
    data?: {
        user?: {
            id: string;
            email: string;
            name?: string;
            [key: string]: any;
        };
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

export default defineEventHandler(async (event) => {
    try {
        // Preview mode: return mock session immediately without checking cookies/headers
        if (isRuntimePreviewMode()) {
            return {
                status: "success",
                data: {
                    user: { id: "preview-user", email: "preview@orbit.local", name: "Preview User" },
                    companies: [{ id: "local", name: "Local Workspace" }],
                },
            };
        }

        let sessionToken = getCookie(event, "session_token");

        if (!sessionToken) {
            const authToken = getCookie(event, "auth.token");
            if (authToken) {
                sessionToken = authToken;
            }
        }

        if (!sessionToken) {
            const authHeader = getHeader(event, "authorization");
            if (authHeader && authHeader.startsWith("Bearer ")) {
                sessionToken = authHeader.slice(7);
            }
        }

        if (!sessionToken) {
            throw createError({
                statusCode: 401,
                statusMessage: "Unauthorized",
                message: "No session token found",
            });
        }

        const apiBaseUrl = resolveApiBaseUrl(resolveConfiguredApiBaseUrl());
        const requestHost = getRequestHeader(event, 'host') || '';

        // Check if token is a JWT (contains two dots)
        if (sessionToken.split('.').length === 3) {
            const jwtSecret = getJwtSecret();
            if (jwtSecret) {
                const decoded = verifyJwtToken(sessionToken, jwtSecret);
                if (decoded && decoded.email) {
                    return {
                        id: decoded.sub || decoded.email,
                        email: decoded.email,
                        name: decoded.name,
                    };
                }
            }
        }

        // Handle fallback SSO tokens (base64-encoded, no dots) when JWT_SECRET is not configured
        if (!sessionToken.includes(".")) {
            try {
                const decoded = Buffer.from(sessionToken, "base64").toString("utf8");
                const parts = decoded.split("|");
                if (parts.length >= 2 && parts[0].includes("@")) {
                    return {
                        id: parts[1] || parts[0],
                        email: parts[0],
                        name: parts[0].split("@")[0],
                    };
                }
            } catch (e) {
                // Fallback: treat as plain user ID
            }
        }

        // In preview mode, when no external API is configured, or when URL points to ourselves,
        // validate against local DB
        if (isPreviewMode() || !apiBaseUrl || isSelfReferencingUrl(apiBaseUrl, requestHost)) {
            const db = getDb();
            const rows = await db.select().from(users).where(eq(users.id, sessionToken)).limit(1);
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

        console.log(`[Session] Forwarding to external API: ${apiBaseUrl}`);
        const response = await $fetch<SessionResponse>(`${apiBaseUrl}/api/v1/auth/session`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${sessionToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        });

        // Guard against non-object responses from the external API
        if (typeof response !== 'object' || response === null || Array.isArray(response)) {
            console.error('[Session] External API returned non-object response:', response);
            throw createError({
                statusCode: 502,
                statusMessage: 'Bad Gateway',
                message: 'External authentication service returned an unexpected response format',
            });
        }

        return response;
    } catch (error: unknown) {
        console.error("Session validation error:", error);

        const err = error as ErrorResponse;
        throw createError({
            statusCode: err.response?.status || (err as any).statusCode || 500,
            statusMessage: err.response?.statusText || (err as any).statusMessage || "Internal Server Error",
            message: err.response?.data?.message || (err as any).message || "An error occurred during session validation",
        });
    }
});
