import { createClient } from "@libsql/client";

export default defineNitroPlugin(async () => {
  const url = process.env.DATABASE_URL || "file:./orbit-docs.sqlite";
  const client = createClient({ url });

  await client.execute(`
    CREATE TABLE IF NOT EXISTS apps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      owner TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      repo_url TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS app_versions (
      id TEXT PRIMARY KEY,
      app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      version TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      app_id TEXT REFERENCES apps(id) ON DELETE SET NULL,
      app_name TEXT,
      action TEXT NOT NULL,
      user TEXT NOT NULL,
      created_at INTEGER
    )
  `);

  // Seed demo data if apps table is empty
  const appsCount = await client.execute("SELECT COUNT(*) as count FROM apps");
  const count = appsCount.rows[0]?.count as number;

  if (count === 0) {
    const appIds = [
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
    ];

    const now = Math.floor(Date.now() / 1000);

    await client.execute({
      sql: `INSERT INTO apps (id, name, description, owner, status, repo_url, created_at, updated_at) VALUES
        (?, ?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        appIds[0], "API Gateway", "Central API routing and rate limiting", "Sarah Chen", "active", "https://github.com/org/api-gateway", now - 172800, now - 172800,
        appIds[1], "Auth Service", "OAuth2 and SSO authentication", "Mike Ross", "active", "https://github.com/org/auth-service", now - 604800, now - 604800,
        appIds[2], "Billing Engine", "Subscription and invoicing logic", "Sarah Chen", "maintenance", "https://github.com/org/billing", now - 259200, now - 259200,
        appIds[3], "Notification Service", "Email, SMS and push notifications", "Jen Park", "active", "https://github.com/org/notifications", now - 1209600, now - 1209600,
        appIds[4], "Data Pipeline", "ETL and streaming data processing", "Sarah Chen", "draft", "https://github.com/org/pipeline", now - 432000, now - 432000,
      ],
    });

    const versionIds = Array.from({ length: 8 }, () => crypto.randomUUID());

    await client.execute({
      sql: `INSERT INTO app_versions (id, app_id, version, status, created_by, created_at, updated_at) VALUES
        (?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        versionIds[0], appIds[0], "2.4.1", "published", "Sarah Chen", now - 172800, now - 172800,
        versionIds[1], appIds[0], "2.4.0", "published", "Sarah Chen", now - 604800, now - 604800,
        versionIds[2], appIds[1], "1.8.0", "published", "Mike Ross", now - 604800, now - 604800,
        versionIds[3], appIds[2], "3.0.2", "published", "Sarah Chen", now - 259200, now - 259200,
        versionIds[4], appIds[3], "1.2.5", "published", "Jen Park", now - 1209600, now - 1209600,
        versionIds[5], appIds[4], "4.1.0-rc", "rc", "Sarah Chen", now - 432000, now - 432000,
        versionIds[6], appIds[0], "2.5.0", "draft", "Sarah Chen", now - 86400, now - 86400,
        versionIds[7], appIds[2], "3.1.0", "draft", "Mike Ross", now - 172800, now - 172800,
      ],
    });

    const activityIds = Array.from({ length: 5 }, () => crypto.randomUUID());

    await client.execute({
      sql: `INSERT INTO activity_logs (id, app_id, app_name, action, user, created_at) VALUES
        (?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?)`,
      args: [
        activityIds[0], appIds[0], "API Gateway", "Published v2.4.1", "Sarah Chen", now - 345600,
        activityIds[1], appIds[2], "Billing Engine", "Updated docs", "Mike Ross", now - 518400,
        activityIds[2], appIds[4], "Data Pipeline", "Created v4.1.0-rc", "Sarah Chen", now - 777600,
        activityIds[3], appIds[1], "Auth Service", "Published changelog", "Jen Park", now - 950400,
        activityIds[4], appIds[3], "Notification Service", "Draft doc created", "Tom Lee", now - 1123200,
      ],
    });
  }
});
