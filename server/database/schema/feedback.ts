import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { apps, docs } from "./apps";

export const docFeedback = pgTable("doc_feedback", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  docId: text("doc_id")
    .notNull()
    .references(() => docs.id, { onDelete: "cascade" }),
  appId: text("app_id").references(() => apps.id, { onDelete: "set null" }),
  helpful: boolean("helpful").notNull(),
  comment: text("comment"),
  status: text("status", { enum: ["open", "resolved", "closed"] })
    .notNull()
    .default("open"),
  visitorId: text("visitor_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const docFeedbackRelations = relations(docFeedback, ({ one }) => ({
  doc: one(docs, {
    fields: [docFeedback.docId],
    references: [docs.id],
  }),
  app: one(apps, {
    fields: [docFeedback.appId],
    references: [apps.id],
  }),
}));
