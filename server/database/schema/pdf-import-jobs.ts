import { pgTable, text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { docs } from "./apps";
import { docAssets } from "./doc-assets";

/**
 * Background PDF-to-markdown conversions. The result waits here until the user inserts or
 * dismisses it (`resolvedAt`), so the import survives a closed tab or laptop.
 */
export const pdfImportJobs = pgTable(
  "pdf_import_jobs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    docId: text("doc_id")
      .notNull()
      .references(() => docs.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => docAssets.id, { onDelete: "cascade" }),
    /** No FK: the env-configured admin's session id is not a `users` row. */
    userId: text("user_id").notNull(),
    status: text("status", { enum: ["extracting", "converting", "completed", "failed", "cancelled"] })
      .notNull()
      .default("extracting"),
    progressPct: integer("progress_pct").notNull().default(0),
    progressMessage: text("progress_message"),
    markdown: text("markdown"),
    pageCount: integer("page_count"),
    usedAi: boolean("used_ai").notNull().default(false),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [index("pdf_import_jobs_doc_user_idx").on(table.docId, table.userId)],
);
