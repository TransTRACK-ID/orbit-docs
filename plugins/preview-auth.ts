/**
 * Preview-specific auth safety plugin.
 *
 * - Patches Vue error handler to catch and log errors instead of crashing
 * - Listens for unhandled promise rejections
 * - Auto-redirects from /login to / if already authenticated (prevents login loop)
 */
export default defineNuxtPlugin((nuxtApp) => {
  if (process.server) return;

  // Patch Vue error handler to catch and log errors instead of crashing
  const originalErrorHandler = nuxtApp.vueApp.config.errorHandler;
  nuxtApp.vueApp.config.errorHandler = (err, instance, info) => {
    console.error("[Preview Auth] Vue error caught:", err, info);
    if (typeof originalErrorHandler === "function") {
      originalErrorHandler(err, instance, info);
    }
  };

  // Listen for unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    console.error("[Preview Auth] Unhandled promise rejection:", event.reason);
  });

  // Auto-redirect from /login to / if already authenticated
  const tryRedirect = () => {
    try {
      const auth = useAuth();
      if (
        auth.status.value === "authenticated" &&
        window.location.pathname === "/login"
      ) {
        console.log("[Preview Auth] Already authenticated, redirecting from /login to /");
        navigateTo("/", { replace: true });
      }
    } catch (e) {
      // useAuth may not be ready yet; ignore
    }
  };

  // Check immediately and after every page navigation
  tryRedirect();
  nuxtApp.hook("page:finish", tryRedirect);
});
