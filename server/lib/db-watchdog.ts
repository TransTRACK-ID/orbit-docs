import { errorCauseMessage } from "~/server/utils/error-cause";

export interface DbWatchdogOptions {
  /** Resolves when the DB is usable; rejects otherwise. */
  probe: () => Promise<unknown>;
  /** Consecutive failed probes before `onExhausted` fires. */
  maxFailures: number;
  /** A probe still pending after this long counts as failed. */
  probeTimeoutMs: number;
  onExhausted: (lastError: string) => void;
  log?: (message: string) => void;
}

/**
 * Returns a tick function that probes the DB and calls `onExhausted` after
 * `maxFailures` consecutive failures. Any success resets the count, so a
 * transient blip never triggers it. Overlapping ticks are skipped.
 */
export function createDbWatchdog(options: DbWatchdogOptions): () => Promise<void> {
  const log = options.log ?? ((m) => console.error(m));
  let failures = 0;
  let inFlight = false;

  return async () => {
    if (inFlight) return;
    inFlight = true;
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = Promise.withResolvers<never>();
      timer = setTimeout(
        () => timeout.reject(new Error(`probe timed out after ${options.probeTimeoutMs}ms`)),
        options.probeTimeoutMs,
      );
      await Promise.race([options.probe(), timeout.promise]);
      if (failures > 0) log(`[db-watchdog] recovered after ${failures} failed probe(s)`);
      failures = 0;
    } catch (err) {
      failures += 1;
      const message = err instanceof Error ? err.message : String(err);
      const cause = errorCauseMessage(err);
      const detail = cause ? `${message} | cause: ${cause}` : message;
      log(`[db-watchdog] probe failed (${failures}/${options.maxFailures}): ${detail}`);
      if (failures >= options.maxFailures) options.onExhausted(detail);
    } finally {
      clearTimeout(timer);
      inFlight = false;
    }
  };
}
