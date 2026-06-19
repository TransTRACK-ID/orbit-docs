/**
 * Security Headers Plugin
 * Adds critical security headers to all HTTP responses.
 * Fixes: C3 (no CSP), H1 (no HSTS), H2 (no XFO), H3 (no COOP), H4 (no X-Content-Type-Options), H5 (no Referrer-Policy), M2 (X-Powered-By).
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event) => {
    // Skip if response headers have already been sent to the client
    // (e.g., streaming endpoints or early error responses)
    if (event.node.res.headersSent) {
      return;
    }

    // Remove X-Powered-By to prevent framework fingerprinting (M2)
    event.node.res.removeHeader('X-Powered-By');

    // Prevent MIME sniffing attacks (H4)
    event.node.res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking on all routes (H2)
    event.node.res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // Referrer policy to prevent URL data leakage (H5)
    event.node.res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // COOP to prevent tabnabbing / cross-window attacks (H3)
    event.node.res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    // CORP to prevent cross-origin resource leaks
    event.node.res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    // Only set Strict-Transport-Security in production (H1)
    // max-age: 1 year, include subdomains, preload-ready
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      event.node.res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    }

    // Content Security Policy (C3)
    // Default CSP that works with the Nuxt SPA + external fonts + Leaflet
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.openstreetmap.org https://*.tile.openstreetmap.org",
      "connect-src 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    event.node.res.setHeader('Content-Security-Policy', csp);
  });
});
