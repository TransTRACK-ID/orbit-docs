import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { apps, appRepositories } from "./apps";
import { users } from "./settings";

export const docGenerationJobs = pgTable("doc_generation_jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  appId: text("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Nullable: product-scoped jobs span many repos and have no single URL.
  repoUrl: text("repo_url"),
  // 'product' = PRD + FSD aggregate + per-repo SDD; 'repo' = single repo SDD (webhook).
  scope: text("scope", { enum: ["product", "repo"] })
    .notNull()
    .default("product"),
  trigger: text("trigger", { enum: ["manual", "webhook"] })
    .notNull()
    .default("manual"),
  // Set for repo-scoped jobs.
  repoId: text("repo_id").references(() => appRepositories.id, {
    onDelete: "set null",
  }),
  status: text("status", {
    enum: [
      "cloning",
      "analyzing",
      "generating_srs",
      "generating_fsd",
      "generating_sdd",
      "writing_back",
      "completed",
      "failed",
      "cancelled",
    ],
  })
    .notNull()
    .default("cloning"),
  progressPct: integer("progress_pct").notNull().default(0),
  progressMessage: text("progress_message").default("Initializing..."),
  // Fine-grained live progress (populated while the agent is streaming).
  // currentActivity = what the agent is doing right now ("Reading: …", "Running: …")
  // partialContent  = streamed text accumulated for the document currently being written
  // lastEventAt     = timestamp of the last streaming event (UI stale-detection)
  // tokens*         = running token usage from the agent's step-finish events
  currentActivity: text("current_activity"),
  partialContent: text("partial_content"),
  lastEventAt: timestamp("last_event_at", { withTimezone: true }),
  tokensInput: integer("tokens_input").notNull().default(0),
  tokensOutput: integer("tokens_output").notNull().default(0),
  srsContent: text("srs_content"),
  fsdContent: text("fsd_content"),
  sddContent: text("sdd_content"),
  errorMessage: text("error_message"),
  repoRef: text("repo_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const docGenerationRepoResults = pgTable("doc_generation_repo_results", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  jobId: text("job_id")
    .notNull()
    .references(() => docGenerationJobs.id, { onDelete: "cascade" }),
  repoId: text("repo_id").references(() => appRepositories.id, {
    onDelete: "set null",
  }),
  repoUrl: text("repo_url").notNull(),
  repoRef: text("repo_ref"),
  sddContent: text("sdd_content"),
  status: text("status", {
    enum: ["pending", "generating", "writing_back", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  prUrl: text("pr_url"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
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
  repoResults: many(docGenerationRepoResults),
}));

export const docGenerationRepoResultsRelations = relations(
  docGenerationRepoResults,
  ({ one }) => ({
    job: one(docGenerationJobs, {
      fields: [docGenerationRepoResults.jobId],
      references: [docGenerationJobs.id],
    }),
    repo: one(appRepositories, {
      fields: [docGenerationRepoResults.repoId],
      references: [appRepositories.id],
    }),
  })
);

export const docGenerationVersionsRelations = relations(docGenerationVersions, ({ one }) => ({
  job: one(docGenerationJobs, {
    fields: [docGenerationVersions.jobId],
    references: [docGenerationJobs.id],
  }),
}));
