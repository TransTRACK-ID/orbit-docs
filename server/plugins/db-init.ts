import { pool } from "~/server/database";
import { getDb } from "~/server/database";
import { apps, appVersions, activityLogs, owners, workspaceSettings, teamMembers, integrationSettings, notificationSettings, apiKeys } from "~/server/database/schema";
import { count } from "drizzle-orm";

export default defineNitroPlugin(async () => {
  // Create tables if they don't exist (PostgreSQL syntax)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS apps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      owner TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      repo_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_versions (
      id TEXT PRIMARY KEY,
      app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      version TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      app_id TEXT REFERENCES apps(id) ON DELETE SET NULL,
      app_name TEXT,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS owners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      role TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspace_settings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Acme Engineering',
      slug TEXT NOT NULL DEFAULT 'acme-engineering',
      description TEXT DEFAULT 'Internal documentation platform for product and engineering teams.',
      theme TEXT NOT NULL DEFAULT 'light',
      logo_url TEXT,
      public_docs_access BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      initials TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      status TEXT NOT NULL DEFAULT 'active',
      invited_by TEXT,
      user_id TEXT,
      last_active TEXT NOT NULL DEFAULT 'just now',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Migrate existing tables that may lack new columns
  await pool.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`);
  await pool.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS invited_by TEXT`);
  await pool.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS user_id TEXT`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS integration_settings (
      id TEXT PRIMARY KEY,
      github_actions BOOLEAN NOT NULL DEFAULT false,
      gitlab_ci BOOLEAN NOT NULL DEFAULT false,
      jenkins BOOLEAN NOT NULL DEFAULT false,
      circle_ci BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_settings (
      id TEXT PRIMARY KEY,
      email_digest BOOLEAN NOT NULL DEFAULT true,
      release_alerts BOOLEAN NOT NULL DEFAULT true,
      doc_comments BOOLEAN NOT NULL DEFAULT false,
      slack_notifications BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      production_key TEXT NOT NULL DEFAULT 'od_live_••••••••••••••••••••••••',
      webhook_secret TEXT NOT NULL DEFAULT 'whsec_••••••••••••••••••••••••••',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Seed demo data if apps table is empty
  const db = getDb();
  const appsCount = await db.select({ count: count() }).from(apps);
  const ownersCount = await db.select({ count: count() }).from(owners);

  if (ownersCount[0]?.count === 0) {
    await db.insert(owners).values([
      { id: crypto.randomUUID(), name: "Sarah Chen", email: "sarah.chen@example.com", role: "Engineering Lead" },
      { id: crypto.randomUUID(), name: "Mike Ross", email: "mike.ross@example.com", role: "Backend Engineer" },
      { id: crypto.randomUUID(), name: "Jen Park", email: "jen.park@example.com", role: "Product Manager" },
      { id: crypto.randomUUID(), name: "Tom Lee", email: "tom.lee@example.com", role: "Technical Writer" },
    ]);
  }

  if (appsCount[0]?.count === 0) {
    const appIds = [
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
    ];

    await db.insert(apps).values([
      { id: appIds[0], name: "API Gateway", description: "Central API routing and rate limiting", owner: "Sarah Chen", status: "active", repoUrl: "https://github.com/org/api-gateway" },
      { id: appIds[1], name: "Auth Service", description: "OAuth2 and SSO authentication", owner: "Mike Ross", status: "active", repoUrl: "https://github.com/org/auth-service" },
      { id: appIds[2], name: "Billing Engine", description: "Subscription and invoicing logic", owner: "Sarah Chen", status: "maintenance", repoUrl: "https://github.com/org/billing" },
      { id: appIds[3], name: "Notification Service", description: "Email, SMS and push notifications", owner: "Jen Park", status: "active", repoUrl: "https://github.com/org/notifications" },
      { id: appIds[4], name: "Data Pipeline", description: "ETL and streaming data processing", owner: "Sarah Chen", status: "draft", repoUrl: "https://github.com/org/pipeline" },
    ]);

    const versionIds = Array.from({ length: 8 }, () => crypto.randomUUID());

    await db.insert(appVersions).values([
      { id: versionIds[0], appId: appIds[0], version: "2.4.1", status: "published", createdBy: "Sarah Chen" },
      { id: versionIds[1], appId: appIds[0], version: "2.4.0", status: "published", createdBy: "Sarah Chen" },
      { id: versionIds[2], appId: appIds[1], version: "1.8.0", status: "published", createdBy: "Mike Ross" },
      { id: versionIds[3], appId: appIds[2], version: "3.0.2", status: "published", createdBy: "Sarah Chen" },
      { id: versionIds[4], appId: appIds[3], version: "1.2.5", status: "published", createdBy: "Jen Park" },
      { id: versionIds[5], appId: appIds[4], version: "4.1.0-rc", status: "rc", createdBy: "Sarah Chen" },
      { id: versionIds[6], appId: appIds[0], version: "2.5.0", status: "draft", createdBy: "Sarah Chen" },
      { id: versionIds[7], appId: appIds[2], version: "3.1.0", status: "draft", createdBy: "Mike Ross" },
    ]);

    const activityIds = Array.from({ length: 5 }, () => crypto.randomUUID());

    await db.insert(activityLogs).values([
      { id: activityIds[0], appId: appIds[0], appName: "API Gateway", action: "Published v2.4.1", actor: "Sarah Chen" },
      { id: activityIds[1], appId: appIds[2], appName: "Billing Engine", action: "Updated docs", actor: "Mike Ross" },
      { id: activityIds[2], appId: appIds[4], appName: "Data Pipeline", action: "Created v4.1.0-rc", actor: "Sarah Chen" },
      { id: activityIds[3], appId: appIds[1], appName: "Auth Service", action: "Published changelog", actor: "Jen Park" },
      { id: activityIds[4], appId: appIds[3], appName: "Notification Service", action: "Draft doc created", actor: "Tom Lee" },
    ]);
  }

  // Seed settings defaults if empty
  const wsCount = await db.select({ count: count() }).from(workspaceSettings);
  if (wsCount[0]?.count === 0) {
    await db.insert(workspaceSettings).values({
      id: crypto.randomUUID(),
      name: "Acme Engineering",
      slug: "acme-engineering",
      description: "Internal documentation platform for product and engineering teams.",
      theme: "light",
      logoUrl: null,
      publicDocsAccess: true,
    });
  }

  const teamCount = await db.select({ count: count() }).from(teamMembers);
  if (teamCount[0]?.count === 0) {
    await db.insert(teamMembers).values([
      { id: crypto.randomUUID(), name: "Sarah Chen", email: "sarah.chen@example.com", initials: "SC", role: "admin", status: "active", lastActive: "2 hours ago" },
      { id: crypto.randomUUID(), name: "Mike Ross", email: "mike.ross@example.com", initials: "MR", role: "product_manager", status: "active", lastActive: "1 day ago" },
      { id: crypto.randomUUID(), name: "Jen Park", email: "jen.park@example.com", initials: "JP", role: "tech_writer", status: "active", lastActive: "3 days ago" },
      { id: crypto.randomUUID(), name: "Tom Lee", email: "tom.lee@example.com", initials: "TL", role: "viewer", status: "active", lastActive: "1 week ago" },
      // Preview-mode admin so local testing works out of the box
      { id: crypto.randomUUID(), name: "Preview User", email: "preview@example.com", userId: "preview-user", initials: "PU", role: "admin", status: "active", lastActive: "just now" },
      // Pending invitation for demo / testing
      { id: crypto.randomUUID(), name: "Alex Rivera", email: "alex@example.com", initials: "AR", role: "tech_writer", status: "pending", invitedBy: "Sarah Chen", lastActive: "invited" },
    ]);
  }

  const integrationCount = await db.select({ count: count() }).from(integrationSettings);
  if (integrationCount[0]?.count === 0) {
    await db.insert(integrationSettings).values({
      id: crypto.randomUUID(),
      githubActions: false,
      gitlabCI: false,
      jenkins: false,
      circleCI: false,
    });
  }

  const notificationCount = await db.select({ count: count() }).from(notificationSettings);
  if (notificationCount[0]?.count === 0) {
    await db.insert(notificationSettings).values({
      id: crypto.randomUUID(),
      emailDigest: true,
      releaseAlerts: true,
      docComments: false,
      slackNotifications: false,
    });
  }

  const apiKeysCount = await db.select({ count: count() }).from(apiKeys);
  if (apiKeysCount[0]?.count === 0) {
    await db.insert(apiKeys).values({
      id: crypto.randomUUID(),
      productionKey: "od_live_••••••••••••••••••••••••",
      webhookSecret: "whsec_••••••••••••••••••••••••••",
    });
  }
});
