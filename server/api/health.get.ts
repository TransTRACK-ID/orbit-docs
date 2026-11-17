import { defineEventHandler, setResponseStatus } from "h3";
import { getPool } from "~/server/database";
import { errorCauseMessage } from "~/server/utils/error-cause";

/**
 * Liveness/readiness probe for Docker HEALTHCHECK (see Dockerfile).
 *
 * Deliberately exercises the DB pool: the failure mode this guards against
 * is a wedged-but-alive process (pool exhausted → every API request pending
 * forever). A bare "process responds" check would pass while the API is
 * dead. With DB_CONNECTION_TIMEOUT_MS bounding pool waits, a wedged pool
 * fails this probe within seconds, the container is marked unhealthy, and
 * the orchestrator/autoheal can restart it — no manual intervention.
 */
export default defineEventHandler(async (event) => {
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    return {
      status: "ok",
      db: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
      memory: process.memoryUsage(),
    };
  } catch (err) {
    setResponseStatus(event, 503);
    const message = err instanceof Error ? err.message : "database unreachable";
    const cause = errorCauseMessage(err);
    return {
      status: "error",
      message,
      ...(cause ? { cause } : {}),
    };
  }
});
