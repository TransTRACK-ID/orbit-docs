import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;
  if (!connectionString) {
    throw new Error(
      "Missing database connection string. Please set POSTGRES_URL in your .env file."
    );
  }
  // Pool hardening: node-postgres defaults wait FOREVER for a free client
  // (connectionTimeoutMillis: 0) and never time out queries, so a few stuck
  // queries wedge the whole API — every later request stays pending until the
  // client/proxy times out, while the process looks alive to Docker and is
  // never restarted. Bound every wait so failures surface as fast 500s and
  // stuck sessions are reclaimed by Postgres instead.
  const statementTimeoutMs = envInt("DB_STATEMENT_TIMEOUT_MS", 120_000);
  const idleInTxTimeoutMs = envInt("DB_IDLE_IN_TRANSACTION_TIMEOUT_MS", 60_000);
  _pool = new Pool({
    connectionString,
    max: envInt("DB_POOL_MAX", 20),
    connectionTimeoutMillis: envInt("DB_CONNECTION_TIMEOUT_MS", 10_000),
    idleTimeoutMillis: envInt("DB_IDLE_TIMEOUT_MS", 30_000),
    query_timeout: statementTimeoutMs || undefined,
    keepAlive: true,
    options:
      `-c statement_timeout=${statementTimeoutMs}` +
      ` -c idle_in_transaction_session_timeout=${idleInTxTimeoutMs}`,
  });
  // Required: an error on an idle pooled client (Postgres restart, network
  // drop, server-side timeout kill) is emitted on the pool. Without a
  // listener Node treats it as an unhandled 'error' event and crashes the
  // process. The pool discards the dead client on its own; just log it.
  _pool.on("error", (err) => {
    console.error("[db] idle pool client error (client discarded):", err);
  });
  return _pool;
}

export const pool = new Proxy({} as Pool, {
  get(target, prop) {
    const p = getPool();
    return (p as any)[prop];
  },
}) as Pool;

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;
  _db = drizzle(getPool(), { schema });
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop) {
    const d = getDb();
    return (d as any)[prop];
  },
}) as ReturnType<typeof drizzle>;
