import { createError, defineEventHandler, deleteCookie, readBody } from "h3";
import { resolveApiBaseUrl } from "../../utils/api-url";

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig();
    const baseUrl = resolveApiBaseUrl(config.apiBaseUrl || config.public.baseAPI);

    // Preview mode: no external API available, return mock response
    if (baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost')) {
      deleteCookie(event, "session_token", { path: "/" });
      return { status: 'success', message: 'Logged out (preview)' };
    }

    const body = await readBody(event);

    const res: any = await $fetch(`${baseUrl}/api/logout`, {
      method: "POST",
      body,
    });

    // Clear the session token cookie on the server side
    deleteCookie(event, "session_token", {
      path: "/",
    });

    return { ...res };
  } catch (error: any) {
    // Even if the third-party logout fails, clear the local cookie
    deleteCookie(event, "session_token", {
      path: "/",
    });

    throw createError({
      statusCode: error.data?.code || 500,
      statusMessage: error.data?.message || "Logout failed",
    });
  }
});
