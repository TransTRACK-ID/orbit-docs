import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Missing database connection string. Please set POSTGRES_URL in your .env file."
  );
}

export const pool = new Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });

export function getDb() {
  return db;
}
