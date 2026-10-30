import { pgTable, text, timestamp, integer, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { docs } from "./apps";

/**
 * Video and PDF attachments of a doc; binaries live in S3 under `docs/{docId}/{assetId}`.
 * Video transcripts are stored in the doc markdown (`:::video` block) so every search path sees them.
 */
export const docAssets = pgTable(
  "doc_assets",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    docId: text("doc_id")
      .notNull()
      .references(() => docs.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["video", "pdf"] }).notNull(),
    s3Key: text("s3_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    fileName: text("file_name").notNull(),
    title: text("title").notNull(),
    status: text("status", { enum: ["pending", "ready"] }).notNull().default("pending"),
    shareToken: text("share_token"),
    shareEnabled: boolean("share_enabled").notNull().default(false),
    sharedAt: timestamp("shared_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("doc_assets_doc_id_idx").on(table.docId),
    uniqueIndex("doc_assets_share_token_unique").on(table.shareToken),
  ],
);

export const docAssetsRelations = relations(docAssets, ({ one }) => ({
  doc: one(docs, {
    fields: [docAssets.docId],
    references: [docs.id],
  }),
}));
