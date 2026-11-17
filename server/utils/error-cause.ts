/** Unwrap Drizzle/pg `error.cause` for logs and health probes. */
export function errorCauseMessage(err: unknown): string | undefined {
  if (!(err instanceof Error) || err.cause == null) return undefined;
  if (err.cause instanceof Error) return err.cause.message;
  return String(err.cause);
}