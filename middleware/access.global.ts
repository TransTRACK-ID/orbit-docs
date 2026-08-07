export default defineNuxtRouteMiddleware(async (to) => {
  const publicPrefixes = ["/login", "/register", "/forgot-password", "/create-new-password", "/p/", "/s/"];
  if (publicPrefixes.some((prefix) => to.path.startsWith(prefix))) {
    return;
  }

  const { can, syncFromCurrentMember } = usePermissions();
  await syncFromCurrentMember();

  const routePermissionMap: Record<string, string> = {
    "/apps": "apps:read",
    "/versions": "versions:read",
    "/releases": "releases:read",
    "/changelogs": "changelogs:read",
    "/docs": "docs:read",
    "/sites": "doc_sites:read",
    "/doc-sites": "doc_sites:read",
    "/api-docs": "api_docs:read",
    "/feedback": "feedback:read",
    "/settings": "settings:read",
  };

  const matched = Object.entries(routePermissionMap).find(([prefix]) =>
    to.path === prefix || to.path.startsWith(`${prefix}/`)
  );

  if (!matched) return;

  const [, permission] = matched;
  if (!can(permission as any)) {
    if (to.path.startsWith("/settings")) {
      return;
    }
    return navigateTo("/settings?denied=1");
  }
});
