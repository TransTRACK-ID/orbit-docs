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

export function isPreviewMode(config: any): boolean {
  return config.isPreview === true || config.isPreview === 'true'
}

/**
 * Checks whether the given API base URL points back to the current app.
 * This prevents auth forwarding loops when API_BASE_URL is set to the app's own URL.
 */
export function isSelfReferencingUrl(apiUrl: string, requestHost: string | undefined): boolean {
  if (!apiUrl || !requestHost) {
    return false
  }
  try {
    const parsed = new URL(apiUrl)
    // Strip port from requestHost for comparison
    const hostWithoutPort = requestHost.split(':')[0]
    return parsed.hostname === hostWithoutPort || parsed.hostname === requestHost
  } catch {
    return false
  }
}
