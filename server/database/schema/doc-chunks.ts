import { pgTable, text, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { docs } from "./apps";

/** Section-level chunks for hybrid semantic search (pgvector column managed via raw SQL). */
export const docChunks = pgTable(
  "doc_chunks",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    docId: text("doc_id")
      .notNull()
      .references(() => docs.id, { onDelete: "cascade" }),
    appId: text("app_id"),
    docType: text("doc_type"),
    heading: text("heading").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("doc_chunks_doc_id_chunk_index_unique").on(table.docId, table.chunkIndex),
    index("doc_chunks_app_doc_type_idx").on(table.appId, table.docType),
    index("doc_chunks_doc_id_idx").on(table.docId),
  ],
);

export const docChunksRelations = relations(docChunks, ({ one }) => ({
  doc: one(docs, {
    fields: [docChunks.docId],
    references: [docs.id],
  }),
}));
