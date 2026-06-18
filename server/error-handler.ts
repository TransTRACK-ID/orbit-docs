/**
 * Custom Nitro error handler
 * Strips stack traces from all error responses to prevent information disclosure (C1).
 */
export default async function (error: any, event: any) {
  const isDev = process.env.NODE_ENV === "development";

  if (error && typeof error === "object") {
    // Log to server console in development for debugging
    if (isDev && error.stack) {
      console.error("[Error]", error.stack);
    }

    // Strip stack from the error object before it is serialized
    // This prevents internal file paths and module names from leaking
    if (error.stack !== undefined) {
      error.stack = undefined;
    }
    delete error.stackTrace;
  }

  // Use H3's default sendError to format and send the response
  // @ts-ignore
  await import("h3").then((h3) => h3.sendError(event, error));
}
