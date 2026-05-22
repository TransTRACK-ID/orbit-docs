import { createError, defineEventHandler, deleteCookie, readBody } from "h3";

export default defineEventHandler(async (event) => {
  try {
    const baseUrl = useRuntimeConfig().public.baseAPI;

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
