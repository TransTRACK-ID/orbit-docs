import { useAuth, defineNuxtRouteMiddleware, navigateTo } from "#imports";

/**
 * Global auth middleware — runs on every route change.
 * Redirects unauthenticated users to /login for protected pages.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // Public pages that don't require authentication
  const publicPaths = ["/login", "/register", "/forgot-password", "/create-new-password"];
  if (publicPaths.includes(to.path)) {
    return;
  }

  const { status, data, getSession } = useAuth();

  // If status is still loading, try to refresh the session
  if (status.value === "loading") {
    try {
      await getSession();
    } catch {
      // Session fetch failed — user is not authenticated
    }
  }

  // If unauthenticated and trying to access a protected page, redirect to login
  if (status.value === "unauthenticated" || !data.value) {
    return navigateTo("/login");
  }
});
