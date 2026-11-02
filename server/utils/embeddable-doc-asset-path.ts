/** Same-origin PDF/video file routes — skip HTML-oriented security headers so iframe preview works. */
function stripAppBasePath(path: string): string {
  const base = (process.env.NUXT_APP_BASE_URL || "/").replace(/\/$/, "");
  if (base && base !== "/" && path.startsWith(`${base}/`)) {
    return path.slice(base.length) || "/";
  }
  return path;
}

export function isEmbeddableDocAssetFilePath(path: string): boolean {
  const normalized = stripAppBasePath(path);
  if (!normalized.startsWith("/api/")) return false;
  if (!normalized.endsWith("/file")) return false;
  return (
    normalized.startsWith("/api/doc-assets/") ||
    normalized.startsWith("/api/public/doc-assets/")
  );
}
