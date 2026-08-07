/**
 * One-off migration: convert legacy manual docs titled "ADR: …" into doc_type = 'adr'.
 *
 * Usage:
 *   npx tsx scripts/migrate-adr-docs.ts
 *   npx tsx scripts/migrate-adr-docs.ts --dry-run
 */
import { config } from "dotenv";
import { and, eq, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { getDb } from "../server/database";
import { docs } from "../server/database/schema/apps";

config();

const dryRun = process.argv.includes("--dry-run");

function parseAdrNumberFromTitle(title: string): number | undefined {
  const match = title.match(/ADR[-\s]?0*(\d+)/i);
  if (!match?.[1]) return undefined;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function main() {
  const db = getDb();

  const candidates = await db
    .select()
    .from(docs)
    .where(
      and(
        or(isNull(docs.docType), ne(docs.docType, "adr")),
        or(ilike(docs.title, "ADR%"), sql`${docs.tags} @> ARRAY['adr']::text[]`)
      )
    );

  if (candidates.length === 0) {
    console.log("No legacy ADR docs found.");
    return;
  }

  console.log(`Found ${candidates.length} candidate doc(s).${dryRun ? " (dry run)" : ""}`);

  for (const doc of candidates) {
    const frontmatter = {
      ...(doc.frontmatter ?? {}),
      adr_status:
        doc.status === "published"
          ? "accepted"
          : ((doc.frontmatter as Record<string, unknown> | null)?.adr_status ?? "proposed"),
      adr_number:
        parseAdrNumberFromTitle(doc.title) ??
        ((doc.frontmatter as Record<string, unknown> | null)?.adr_number as number | undefined),
    };

    console.log(`- ${doc.id}: "${doc.title}" → doc_type=adr, adr_status=${frontmatter.adr_status}`);

    if (!dryRun) {
      await db
        .update(docs)
        .set({
          docType: "adr",
          frontmatter,
          updatedAt: new Date(),
        })
        .where(eq(docs.id, doc.id));
    }
  }

  console.log(dryRun ? "Dry run complete." : "Migration complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
