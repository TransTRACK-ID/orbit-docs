import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;
  if (!connectionString) {
    throw new Error(
      "Missing database connection string. Please set POSTGRES_URL in your .env file."
    );
  }
  _pool = new Pool({ connectionString });
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
