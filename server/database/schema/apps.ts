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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const docsRelations = relations(docs, ({ one }) => ({
  app: one(apps, {
    fields: [docs.appId],
    references: [apps.id],
  }),
  version: one(appVersions, {
    fields: [docs.versionId],
    references: [appVersions.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  app: one(apps, {
    fields: [activityLogs.appId],
    references: [apps.id],
  }),
}));

export interface EmbedNavItem {
  type: "section" | "indent";
  text: string;
  slug?: string;
  active?: boolean;
}

export const docEmbeds = pgTable("doc_embeds", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  appId: text("app_id").references(() => apps.id, { onDelete: "cascade" }),
  versionId: text("version_id").references(() => appVersions.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  subtitle: text("subtitle"),
  navItems: jsonb("nav_items").$type<EmbedNavItem[]>().default([]),
  content: text("content").default(""),
  status: text("status", { enum: ["draft", "published", "archived"] })
    .notNull()
    .default("draft"),
  author: text("author"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const docEmbedsRelations = relations(docEmbeds, ({ one }) => ({
  app: one(apps, {
    fields: [docEmbeds.appId],
    references: [apps.id],
  }),
  version: one(appVersions, {
    fields: [docEmbeds.versionId],
    references: [appVersions.id],
  }),
}));
