import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { apps } from "./apps";
import { users } from "./settings";

export const docGenerationJobs = pgTable("doc_generation_jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  appId: text("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  repoUrl: text("repo_url").notNull(),
  status: text("status", {
    enum: [
      "cloning",
      "analyzing",
      "generating_srs",
      "generating_fsd",
      "generating_sdd",
      "completed",
      "failed",
      "cancelled",
    ],
  })
    .notNull()
    .default("cloning"),
  progressPct: integer("progress_pct").notNull().default(0),
  progressMessage: text("progress_message").default("Initializing..."),
  srsContent: text("srs_content"),
  fsdContent: text("fsd_content"),
  sddContent: text("sdd_content"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const docGenerationVersions = pgTable("doc_generation_versions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  jobId: text("job_id")
    .notNull()
    .references(() => docGenerationJobs.id, { onDelete: "cascade" }),
  docType: text("doc_type", { enum: ["srs", "fsd", "sdd"] }).notNull(),
  content: text("content").default(""),
  actor: text("actor"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const docGenerationJobsRelations = relations(docGenerationJobs, ({ one, many }) => ({
  app: one(apps, {
    fields: [docGenerationJobs.appId],
    references: [apps.id],
  }),
  user: one(users, {
    fields: [docGenerationJobs.userId],
    references: [users.id],
  }),
  versions: many(docGenerationVersions),
}));

export const docGenerationVersionsRelations = relations(docGenerationVersions, ({ one }) => ({
  job: one(docGenerationJobs, {
    fields: [docGenerationVersions.jobId],
    references: [docGenerationJobs.id],
  }),
}));
