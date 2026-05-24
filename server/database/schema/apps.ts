import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
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

export const appsRelations = relations(apps, ({ many }) => ({
  versions: many(appVersions),
  activities: many(activityLogs),
}));

export const appVersionsRelations = relations(appVersions, ({ one }) => ({
  app: one(apps, {
    fields: [appVersions.appId],
    references: [apps.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  app: one(apps, {
    fields: [activityLogs.appId],
    references: [apps.id],
  }),
}));
