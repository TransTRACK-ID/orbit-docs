/**
 * Resolves the API base URL for server-side fetch calls.
 * In preview mode, baseAPI may be a relative path (e.g. /api/preview/taskId).
 * Server-side $fetch requires an absolute URL, so we prepend the internal origin.
 */
export function resolveApiBaseUrl(baseAPI: string | undefined): string {
  if (!baseAPI) {
    return ''
  }
  // Already absolute
  if (baseAPI.startsWith('http://') || baseAPI.startsWith('https://')) {
    return baseAPI
  }
  // Relative path — prepend internal dev server origin
  const port = process.env.PORT || process.env.NUXT_PORT || '3000'
  return `http://127.0.0.1:${port}${baseAPI}`
}
