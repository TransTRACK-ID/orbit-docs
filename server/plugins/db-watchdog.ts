import { getPool } from "~/server/database";
import { createDbWatchdog } from "~/server/lib/db-watchdog";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Self-restart when the DB pool stays unusable (the wedged state where
 * /api/health returns 503 and every API request hangs until timeout, and only
 * a container restart recovers). Exiting lets Docker's `restart:` policy
 * bring up a fresh process — no autoheal/docker.sock needed on the host.
 *
 * Off in `nuxt dev` and on Vercel; DB_WATCHDOG_MAX_FAILURES=0 disables it.
 */
export default defineNitroPlugin(() => {
  if (import.meta.dev || process.env.VERCEL) return;

  const maxFailures = envInt("DB_WATCHDOG_MAX_FAILURES", 4);
  if (maxFailures === 0) return;
  const intervalMs = envInt("DB_WATCHDOG_INTERVAL_MS", 30_000) || 30_000;

  const tick = createDbWatchdog({
    probe: () => getPool().query("SELECT 1"),
    maxFailures,
    probeTimeoutMs: 15_000,
    onExhausted: (lastError) => {
      console.error(
        `[db-watchdog] DB unusable for ${maxFailures} consecutive probes ` +
          `(~${Math.round((maxFailures * intervalMs) / 1000)}s), exiting so the ` +
          `container restarts. Last error: ${lastError}`,
      );
      process.exit(1);
    },
  });

  setInterval(tick, intervalMs).unref?.();
});
