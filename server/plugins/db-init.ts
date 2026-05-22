import { pool } from "~/server/database";
import { getDb } from "~/server/database";
import { apps, appVersions, activityLogs } from "~/server/database/schema";
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
      user TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Seed demo data if apps table is empty
  const db = getDb();
  const appsCount = await db.select({ count: count() }).from(apps);

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
      { id: activityIds[0], appId: appIds[0], appName: "API Gateway", action: "Published v2.4.1", user: "Sarah Chen" },
      { id: activityIds[1], appId: appIds[2], appName: "Billing Engine", action: "Updated docs", user: "Mike Ross" },
      { id: activityIds[2], appId: appIds[4], appName: "Data Pipeline", action: "Created v4.1.0-rc", user: "Sarah Chen" },
      { id: activityIds[3], appId: appIds[1], appName: "Auth Service", action: "Published changelog", user: "Jen Park" },
      { id: activityIds[4], appId: appIds[3], appName: "Notification Service", action: "Draft doc created", user: "Tom Lee" },
    ]);
  }
});
