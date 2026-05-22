import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./server/database/schema/index.ts",
  out: "./server/database/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL || "file:./orbit-docs.sqlite",
  },
});
