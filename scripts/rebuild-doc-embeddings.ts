/**
 * Backfill doc chunk embeddings for feature + SDD docs.
 *
 * Usage:
 *   npx tsx scripts/rebuild-doc-embeddings.ts
 *   npx tsx scripts/rebuild-doc-embeddings.ts --app-id=<uuid>
 *   npx tsx scripts/rebuild-doc-embeddings.ts --doc-types=feature,sdd --dry-run
 */
import { config } from "dotenv";
import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "../server/database";
import { docs } from "../server/database/schema/apps";
import { INDEXABLE_DOC_TYPES } from "../server/lib/doc-chunking";
import { indexDocChunks } from "../server/lib/doc-embeddings";

config();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const appId = readArg("app-id");
  const docTypesArg = readArg("doc-types");
  const docTypes = docTypesArg
    ? docTypesArg.split(",").map((t) => t.trim()).filter(Boolean)
    : [...INDEXABLE_DOC_TYPES];

  const invalid = docTypes.filter(
    (t) => !INDEXABLE_DOC_TYPES.includes(t as (typeof INDEXABLE_DOC_TYPES)[number]),
  );
  if (invalid.length > 0) {
    console.error(`Invalid doc types: ${invalid.join(", ")}`);
    process.exit(1);
  }

  const db = getDb();
  const conditions = [
    inArray(docs.docType, docTypes as Array<(typeof INDEXABLE_DOC_TYPES)[number]>),
    ne(docs.status, "archived"),
  ];

  if (appId) {
    conditions.push(eq(docs.appId, appId));
  }

  const rows = await db
    .select({ id: docs.id, title: docs.title, docType: docs.docType, appId: docs.appId })
    .from(docs)
    .where(and(...conditions))
    .orderBy(docs.updatedAt);

  console.log(`Found ${rows.length} docs to index (${docTypes.join(", ")})`);

  if (dryRun) {
    for (const row of rows.slice(0, 20)) {
      console.log(`- [${row.docType}] ${row.title} (${row.id})`);
    }
    if (rows.length > 20) console.log(`... and ${rows.length - 20} more`);
    return;
  }

  let indexed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const result = await indexDocChunks(row.id);
      if (result.skipped) {
        skipped += 1;
        console.log(`skip ${row.id} (${result.reason})`);
      } else {
        indexed += 1;
        console.log(`ok ${row.id} (${result.indexed} chunks) — ${row.title}`);
      }
    } catch (err) {
      failed += 1;
      console.error(`fail ${row.id}:`, err);
    }
  }

  console.log(`Done. indexed=${indexed} skipped=${skipped} failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
