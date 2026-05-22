import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const apps = sqliteTable("apps", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  owner: text("owner"),
  status: text("status", { enum: ["active", "draft", "maintenance"] })
    .notNull()
    .default("active"),
  repoUrl: text("repo_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export const appVersions = sqliteTable("app_versions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  appId: text("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  status: text("status", { enum: ["draft", "published", "rc"] })
    .notNull()
    .default("draft"),
  createdBy: text("created_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export const activityLogs = sqliteTable("activity_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  appId: text("app_id").references(() => apps.id, { onDelete: "set null" }),
  appName: text("app_name"),
  action: text("action").notNull(),
  user: text("user").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
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
