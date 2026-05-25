import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { apps, appVersions } from "./apps";

export const changelogs = pgTable("changelogs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  appId: text("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  versionId: text("version_id").references(() => appVersions.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  content: text("content").default(""),
  status: text("status", { enum: ["draft", "published"] })
    .notNull()
    .default("draft"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const changelogsRelations = relations(changelogs, ({ one }) => ({
  app: one(apps, {
    fields: [changelogs.appId],
    references: [apps.id],
  }),
  version: one(appVersions, {
    fields: [changelogs.versionId],
    references: [appVersions.id],
  }),
}));
