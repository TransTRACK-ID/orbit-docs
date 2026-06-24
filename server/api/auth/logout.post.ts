import { createError, defineEventHandler, readBody, setCookie } from "h3";
import { resolveApiBaseUrl, isPreviewMode } from "../../utils/api-url";
import { resolveConfiguredApiBaseUrl } from "~/server/utils/runtime-env";

export default defineEventHandler(async (event) => {
  try {
    const baseUrl = resolveApiBaseUrl(resolveConfiguredApiBaseUrl());

    // Preview mode: no external API available, return mock response
    if (isPreviewMode()) {
      setCookie(event, "session_token", "", { path: "/", maxAge: 0 });
      setCookie(event, "auth.token", "", { path: "/", maxAge: 0 });
      setCookie(event, "user_info", "", { path: "/", maxAge: 0 });
      setCookie(event, "sso_oauth_state", "", { path: "/", maxAge: 0 });
      return { status: 'success', message: 'Logged out (preview)' };
    }

    const body = await readBody(event);

    const res: any = await $fetch(`${baseUrl}/api/logout`, {
      method: "POST",
      body,
    });

    // Clear all auth cookies on the server side
    setCookie(event, "session_token", "", { path: "/", maxAge: 0 });
    setCookie(event, "auth.token", "", { path: "/", maxAge: 0 });
    setCookie(event, "user_info", "", { path: "/", maxAge: 0 });
    setCookie(event, "sso_oauth_state", "", { path: "/", maxAge: 0 });

    return { ...res };
  } catch (error: any) {
    // Even if the third-party logout fails, clear the local cookies
    setCookie(event, "session_token", "", { path: "/", maxAge: 0 });
    setCookie(event, "auth.token", "", { path: "/", maxAge: 0 });
    setCookie(event, "user_info", "", { path: "/", maxAge: 0 });
    setCookie(event, "sso_oauth_state", "", { path: "/", maxAge: 0 });

    throw createError({
      statusCode: error.data?.code || 500,
      statusMessage: error.data?.message || "Logout failed",
    });
  }
});
