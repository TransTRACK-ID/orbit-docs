import { pgTable, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { apps, appVersions } from "./apps";

export const releases = pgTable("releases", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  appId: text("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  versionId: text("version_id").references(() => appVersions.id, { onDelete: "set null" }),
  heroTitle: text("hero_title"),
  summary: text("summary"),
  features: jsonb("features").$type<
    Array<{
      id: string;
      heading: string;
      description: string;
      media?: Array<{ type: "image" | "video"; src: string; alt: string }>;
    }>
  >(),
  categories: jsonb("categories").$type<{
    added?: string[];
    fixed?: string[];
    changed?: string[];
    deprecated?: string[];
    security?: string[];
  }>(),
  type: text("type").notNull().default("normal"),
  published: boolean("published").notNull().default(false),
  notionPageId: text("notion_page_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const releaseVersions = pgTable("release_versions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  releaseId: text("release_id")
    .notNull()
    .references(() => releases.id, { onDelete: "cascade" }),
  heroTitle: text("hero_title"),
  summary: text("summary"),
  published: boolean("published").notNull().default(false),
  action: text("action").notNull().default("save"),
  actor: text("actor"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const releasesRelations = relations(releases, ({ one, many }) => ({
  app: one(apps, {
    fields: [releases.appId],
    references: [apps.id],
  }),
  version: one(appVersions, {
    fields: [releases.versionId],
    references: [appVersions.id],
  }),
  versions: many(releaseVersions),
}));

export const releaseVersionsRelations = relations(releaseVersions, ({ one }) => ({
  release: one(releases, {
    fields: [releaseVersions.releaseId],
    references: [releases.id],
  }),
}));
