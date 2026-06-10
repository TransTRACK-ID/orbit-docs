/**
 * Prepends the app's baseURL (e.g. /docs) to a given path.
 * Use this when generating externally-accessible URLs on the server.
 */
export function withBaseURL(path: string): string {
  const baseURL = process.env.NUXT_APP_BASE_URL || useRuntimeConfig().app.baseURL || '/'
  const base = baseURL.replace(/\/$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${cleanPath}`
}
