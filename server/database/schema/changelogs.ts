import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { apps, appVersions } from "./apps";

export const changelogs = pgTable("changelogs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  appId: text("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  versionId: text("version_id")
    .references(() => appVersions.id, { onDelete: "set null" }),
  content: text("content").default(""),
  status: text("status", { enum: ["draft", "published", "archived"] })
    .notNull()
    .default("draft"),
  author: text("author"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const changelogHistory = pgTable("changelog_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  changelogId: text("changelog_id")
    .notNull()
    .references(() => changelogs.id, { onDelete: "cascade" }),
  content: text("content").default(""),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const changelogsRelations = relations(changelogs, ({ one, many }) => ({
  app: one(apps, {
    fields: [changelogs.appId],
    references: [apps.id],
  }),
  version: one(appVersions, {
    fields: [changelogs.versionId],
    references: [appVersions.id],
  }),
  history: many(changelogHistory),
}));

export const changelogHistoryRelations = relations(changelogHistory, ({ one }) => ({
  changelog: one(changelogs, {
    fields: [changelogHistory.changelogId],
    references: [changelogs.id],
  }),
}));
