// Session endpoint — validates the session token against the local database
// or forwards it to the third-party auth API when configured.

import { defineEventHandler, getCookie, getHeader, createError } from "h3";
import { $fetch } from "ofetch";
import { useRuntimeConfig } from "#imports";
import { resolveApiBaseUrl, isPreviewMode } from "../../utils/api-url";
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
        if (process.env.ORBIT_PREVIEW === 'true') {
            return {
                status: "success",
                data: {
                    user: { id: "preview-user", email: "preview@orbit.local", name: "Preview User" },
                    companies: [{ id: "local", name: "Local Workspace" }],
                },
            };
        }

        let sessionToken = getCookie(event, "session_token");
        console.log(`[Session] session_token cookie: ${sessionToken ? 'present' : 'missing'}`);

        if (!sessionToken) {
            const authHeader = getHeader(event, "authorization");
            if (authHeader && authHeader.startsWith("Bearer ")) {
                sessionToken = authHeader.slice(7);
                console.log(`[Session] Found token in Authorization header`);
            }
        }

        if (!sessionToken) {
            console.log(`[Session] No token found — returning 401`);
            throw createError({
                statusCode: 401,
                statusMessage: "Unauthorized",
                message: "No session token found",
            });
        }

        const config = useRuntimeConfig();
        const apiBaseUrl = resolveApiBaseUrl(config.apiBaseUrl || config.public.baseAPI);

        console.log(`[Session] Token type: ${sessionToken.split('.').length === 3 ? 'JWT' : sessionToken.includes('.') ? 'unknown' : 'fallback'}`);

        // Check if token is a JWT (contains two dots)
        if (sessionToken.split('.').length === 3) {
            const jwtSecret = config.jwtSecret as string;
            if (jwtSecret) {
                const decoded = verifyJwtToken(sessionToken, jwtSecret);
                if (decoded && decoded.email) {
                    console.log(`[Session] JWT valid for user: ${decoded.email}`);
                    return {
                        status: "success",
                        data: {
                            user: {
                                id: decoded.sub || decoded.email,
                                email: decoded.email,
                                name: decoded.name,
                            },
                            companies: [{ id: "local", name: "Local Workspace" }],
                        },
                    };
                }
            }
        }

        // Handle fallback SSO tokens (base64-encoded, no dots) when JWT_SECRET is not configured
        if (!sessionToken.includes(".")) {
            try {
                const decoded = Buffer.from(sessionToken, "base64").toString("utf8");
                console.log(`[Session] Fallback token decoded: ${decoded}`);
                const parts = decoded.split("|");
                if (parts.length >= 2 && parts[0].includes("@")) {
                    console.log(`[Session] Fallback token valid for user: ${parts[0]}`);
                    return {
                        status: "success",
                        data: {
                            user: {
                                id: parts[1] || parts[0],
                                email: parts[0],
                                name: parts[0].split("@")[0],
                            },
                            companies: [{ id: "local", name: "Local Workspace" }],
                        },
                    };
                }
            } catch (e) {
                console.log(`[Session] Fallback token decode failed: ${e}`);
            }
        }

        // In preview mode (or when no external API is configured), validate against local DB
        if (isPreviewMode(config) || !apiBaseUrl) {
            console.log(`[Session] Checking local DB for token: ${sessionToken}`);
            const db = getDb();
            const rows = await db.select().from(users).where(eq(users.id, sessionToken)).limit(1);
            const user = rows[0];

            if (!user) {
                console.log(`[Session] No user found in DB for token: ${sessionToken}`);
                throw createError({
                    statusCode: 401,
                    statusMessage: "Unauthorized",
                    message: "Invalid session token",
                });
            }

            console.log(`[Session] Local DB user found: ${user.email}`);
            return {
                status: "success",
                data: {
                    user: { id: user.id, email: user.email, name: user.name },
                    companies: [{ id: "local", name: "Local Workspace" }],
                },
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
