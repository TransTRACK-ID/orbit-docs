import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const apps = pgTable("apps", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  owner: text("owner"),
  status: text("status", { enum: ["active", "draft", "maintenance"] })
    .notNull()
    .default("active"),
  repoUrl: text("repo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const appVersions = pgTable("app_versions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  appId: text("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  status: text("status", { enum: ["draft", "published", "rc", "archived"] })
    .notNull()
    .default("draft"),
  createdBy: text("created_by"),
  releaseDate: timestamp("release_date", { withTimezone: true }),
  releaseNotes: text("release_notes"),
  branch: text("branch"),
  tags: text("tags"),
  commitHash: text("commit_hash"),
  approver: text("approver"),
  ciStatus: text("ci_status", { enum: ["passed", "failed", "pending", "unknown"] })
    .notNull()
    .default("unknown"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  appId: text("app_id").references(() => apps.id, { onDelete: "set null" }),
  appName: text("app_name"),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const appRepositories = pgTable("app_repositories", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  appId: text("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  repoUrl: text("repo_url").notNull(),
  provider: text("provider", { enum: ["github", "gitlab"] })
    .notNull()
    .default("github"),
  // Non-null when the provider is self-hosted (e.g. https://gitlab.mycompany.com).
  // For github.com / gitlab.com leave null.
  hostUrl: text("host_url"),
  defaultBranch: text("default_branch").notNull().default("main"),
  accessToken: text("access_token"),
  webhookSecret: text("webhook_secret"),
  sddDocPath: text("sdd_doc_path").notNull().default("docs/SDD.md"),
  lastProcessedRef: text("last_processed_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const appsRelations = relations(apps, ({ many }) => ({
  versions: many(appVersions),
  activities: many(activityLogs),
  repositories: many(appRepositories),
}));

export const appRepositoriesRelations = relations(appRepositories, ({ one }) => ({
  app: one(apps, {
    fields: [appRepositories.appId],
    references: [apps.id],
  }),
}));

export const appVersionsRelations = relations(appVersions, ({ one }) => ({
  app: one(apps, {
    fields: [appVersions.appId],
    references: [apps.id],
  }),
}));

export const docs = pgTable("docs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  appId: text("app_id").references(() => apps.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").default(""),
  status: text("status", { enum: ["draft", "in_review", "published", "archived"] })
    .notNull()
    .default("draft"),
  versionId: text("version_id").references(() => appVersions.id, { onDelete: "set null" }),
  tags: text("tags").array().default([]),
  author: text("author"),
  source: text("source", { enum: ["manual", "generated"] })
    .notNull()
    .default("manual"),
  docType: text("doc_type", { enum: ["srs", "fsd", "sdd"] }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const docsRelations = relations(docs, ({ one, many }) => ({
  app: one(apps, {
    fields: [docs.appId],
    references: [apps.id],
  }),
  version: one(appVersions, {
    fields: [docs.versionId],
    references: [appVersions.id],
  }),
  docVersions: many(docVersions),
}));

export const versionHistory = pgTable("version_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  versionId: text("version_id")
    .notNull()
    .references(() => appVersions.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  action: text("action").notNull().default("save"),
  actor: text("actor"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const versionHistoryRelations = relations(versionHistory, ({ one }) => ({
  version: one(appVersions, {
    fields: [versionHistory.versionId],
    references: [appVersions.id],
  }),
}));

export const docVersions = pgTable("doc_versions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  docId: text("doc_id")
    .notNull()
    .references(() => docs.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  content: text("content").default(""),
  title: text("title"),
  actor: text("actor"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const docVersionsRelations = relations(docVersions, ({ one }) => ({
  doc: one(docs, {
    fields: [docVersions.docId],
    references: [docs.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  app: one(apps, {
    fields: [activityLogs.appId],
    references: [apps.id],
  }),
}));


