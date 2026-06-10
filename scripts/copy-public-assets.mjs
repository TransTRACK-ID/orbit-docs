/**
 * Nitro's node-server preset embeds a manifest of public assets whose paths
 * resolve to `.output/server/chunks/public/` (relative to nitro.mjs). The
 * build step writes files to `.output/public/` instead, so we mirror them here.
 * Without this copy, requests to /{baseURL}/_nuxt/* throw ENOENT in production.
 */
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const src = join(process.cwd(), ".output/public");
const dest = join(process.cwd(), ".output/server/chunks/public");

if (!existsSync(src)) {
  console.warn("[postbuild] .output/public not found — skipping public asset copy");
  process.exit(0);
}

cpSync(src, dest, { recursive: true });
console.log("[postbuild] Copied .output/public → .output/server/chunks/public");
