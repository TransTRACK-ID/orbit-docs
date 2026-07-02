import { pgTable, text, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { docGenerationJobs } from "./doc-generation-jobs";
import { users } from "./settings";

export const docGenerationComments = pgTable("doc_generation_comments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  jobId: text("job_id")
    .notNull()
    .references(() => docGenerationJobs.id, { onDelete: "cascade" }),
  docKey: text("doc_key").notNull(),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  quote: text("quote"),
  status: text("status", { enum: ["open", "resolved"] })
    .notNull()
    .default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const docGenerationReviews = pgTable(
  "doc_generation_reviews",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    jobId: text("job_id")
      .notNull()
      .references(() => docGenerationJobs.id, { onDelete: "cascade" }),
    docKey: text("doc_key").notNull(),
    status: text("status", {
      enum: ["in_review", "approved", "changes_requested"],
    })
      .notNull()
      .default("in_review"),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    jobDocUnique: uniqueIndex("doc_generation_reviews_job_doc_unique").on(
      table.jobId,
      table.docKey
    ),
  })
);

export const docGenerationCommentsRelations = relations(docGenerationComments, ({ one }) => ({
  job: one(docGenerationJobs, {
    fields: [docGenerationComments.jobId],
    references: [docGenerationJobs.id],
  }),
}));

export const docGenerationReviewsRelations = relations(docGenerationReviews, ({ one }) => ({
  job: one(docGenerationJobs, {
    fields: [docGenerationReviews.jobId],
    references: [docGenerationJobs.id],
  }),
}));
