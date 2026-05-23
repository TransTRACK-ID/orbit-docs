// Session endpoint — validates the session token against the local database
// or forwards it to the third-party auth API when configured.

import { defineEventHandler, getCookie, getHeader, createError } from "h3";
import { $fetch } from "ofetch";
import { useRuntimeConfig } from "#imports";
import { resolveApiBaseUrl, isPreviewMode } from "../../utils/api-url";
import { getDb } from "~/server/database";
import { users } from "~/server/database/schema";
import { eq } from "drizzle-orm";

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

        const config = useRuntimeConfig();
        const apiBaseUrl = resolveApiBaseUrl(config.apiBaseUrl || config.public.baseAPI);

        // In preview mode (or when no external API is configured), validate against local DB
        if (isPreviewMode(config) || !apiBaseUrl) {
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
                status: "success",
                data: {
                    user: { id: user.id, email: user.email, name: user.name },
                    companies: [{ id: "local", name: "Local Workspace" }],
                },
            };
        }

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
