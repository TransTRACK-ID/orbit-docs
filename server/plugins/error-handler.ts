/**
 * Error handler plugin
 * Strips stack traces from JSON error responses to prevent information disclosure (C1).
 * In development, logs the stack to the server console for debugging but never sends it to the client.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, event) => {
    const isDev = process.env.NODE_ENV === 'development';

    if (error && typeof error === 'object') {
      const err = error as any;

      // In development, log the stack to the server console before stripping
      if (isDev && err.stack) {
        console.error('[Error]', err.stack);
      }

      // Always strip the stack from the error object so it never reaches the client
      // This protects against accidental deployments without NODE_ENV=production
      if (err.stack !== undefined) {
        err.stack = undefined;
      }
      delete err.stackTrace;
    }
  });
});
