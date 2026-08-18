export const PUBLIC_PATHS = ["/"] as const;

export const PUBLIC_ROUTE_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/create-new-password",
  "/p/",
  "/s/",
  "/support",
] as const;

export function isPublicRoute(path: string): boolean {
  return (
    (PUBLIC_PATHS as readonly string[]).includes(path)
    || PUBLIC_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}
