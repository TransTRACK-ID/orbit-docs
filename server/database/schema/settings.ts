import { pgTable, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const workspaceSettings = pgTable("workspace_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().default("Acme Engineering"),
  slug: text("slug").notNull().default("acme-engineering"),
  description: text("description").default("Internal documentation platform for product and engineering teams."),
  theme: text("theme", { enum: ["light", "dark", "system"] }).notNull().default("light"),
  logoUrl: text("logo_url"),
  publicDocsAccess: boolean("public_docs_access").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const teamMembers = pgTable("team_members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email"),
  initials: text("initials").notNull(),
  role: text("role", { enum: ["admin", "product_manager", "tech_writer", "viewer"] })
    .notNull()
    .default("viewer"),
  status: text("status", { enum: ["pending", "active"] })
    .notNull()
    .default("active"),
  invitedBy: text("invited_by"),
  userId: text("user_id"),
  lastActive: text("last_active").notNull().default("just now"),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const integrationSettings = pgTable("integration_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  githubActions: boolean("github_actions").notNull().default(false),
  gitlabCI: boolean("gitlab_ci").notNull().default(false),
  jenkins: boolean("jenkins").notNull().default(false),
  circleCI: boolean("circle_ci").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const notificationSettings = pgTable("notification_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  emailDigest: boolean("email_digest").notNull().default(true),
  releaseAlerts: boolean("release_alerts").notNull().default(true),
  docComments: boolean("doc_comments").notNull().default(false),
  slackNotifications: boolean("slack_notifications").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const docGenerationSettings = pgTable("doc_generation_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  srsEnabled: boolean("srs_enabled").notNull().default(true),
  fsdEnabled: boolean("fsd_enabled").notNull().default(true),
  gitSnapshotEnabled: boolean("git_snapshot_enabled").notNull().default(true),
  sddIndexEnabled: boolean("sdd_index_enabled").notNull().default(true),
  sddPerRepoEnabled: boolean("sdd_per_repo_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  productionKey: text("production_key").notNull().default("od_live_" + generatePlaceholder()),
  webhookSecret: text("webhook_secret").notNull().default("whsec_" + generatePlaceholder()),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Generic key-value settings table for app-level configuration (e.g. SSO)
export const settings = pgTable("settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  value: jsonb("value"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

function generatePlaceholder(): string {
  return "••••••••••••••••••••••••";
}
