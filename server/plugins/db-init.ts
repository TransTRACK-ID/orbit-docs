import { pool } from "~/server/database";
import { getDb } from "~/server/database";
import { apps, appVersions, activityLogs, docs } from "~/server/database/schema";
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS docs (
      id TEXT PRIMARY KEY,
      app_id TEXT REFERENCES apps(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      version_id TEXT REFERENCES app_versions(id) ON DELETE SET NULL,
      tags TEXT[] DEFAULT ARRAY[]::TEXT[],
      author TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

    const docsCountResult = await db.select({ count: count() }).from(docs);
    if (docsCountResult[0]?.count === 0) {
      const docIds = Array.from({ length: 3 }, () => crypto.randomUUID());
      await db.insert(docs).values([
        {
          id: docIds[0],
          appId: appIds[0],
          title: "API Gateway — Developer Docs",
          content: `# Getting Started\n\n## Installation\n\nInstall the API Gateway SDK via npm:\n\n\`\`\`bash\nnpm install @orbit/api-gateway\n\`\`\`\n\n## Quick Start\n\n1. Create an API key from the dashboard\n2. Initialize the client\n3. Make your first request\n\n---\n\n# Authentication\n\nAll requests must include a valid API key in the \`Authorization\` header.\n\n## API Keys\n\n- Production keys start with \`orbit_live_\`\n- Sandbox keys start with \`orbit_test_\`\n- Rotate keys every 90 days\n\n---\n\n# Endpoints\n\n## POST /v2/batch\n\nExecute multiple operations in a single request.\n\n| Parameter | Type | Required | Description |\n|-----------|------|----------|-------------|\n| operations | array | Yes | Max 100 per batch |\n| atomic | boolean | No | Rollback all on failure |\n\n---\n\n# Error Handling\n\nThe API uses standard HTTP status codes:\n\n- \`200\` — Success\n- \`400\` — Bad Request\n- \`401\` — Unauthorized\n- \`429\` — Rate Limited\n- \`500\` — Server Error\n`,
          status: "draft",
          versionId: versionIds[0],
          tags: ["api", "gateway", "v2.4"],
          author: "Sarah Chen",
        },
        {
          id: docIds[1],
          appId: appIds[1],
          title: "Auth Service — SSO Guide",
          content: `# SSO Guide\n\n## Overview\n\nThis guide covers integrating the Auth Service for single sign-on.\n\n## OAuth 2.0 Flow\n\n1. Redirect user to \`/oauth/authorize\`\n2. Exchange code for token\n3. Use token to access protected resources\n\n---\n\n# Configuration\n\nSet the following environment variables:\n\n\`\`\`bash\nAUTH_CLIENT_ID=your_client_id\nAUTH_CLIENT_SECRET=your_client_secret\nAUTH_REDIRECT_URI=https://app.example.com/callback\n\`\`\`\n`,
          status: "published",
          versionId: versionIds[2],
          tags: ["auth", "sso", "oauth"],
          author: "Mike Ross",
        },
        {
          id: docIds[2],
          appId: appIds[3],
          title: "Notification Service — Webhooks",
          content: `# Webhooks\n\n## Setup\n\nRegister webhook URLs in the dashboard.\n\n## Payload Format\n\n\`\`\`json\n{\n  \"event\": \"message.sent\",\n  \"payload\": { ... }\n}\n\`\`\`\n\n## Retry Policy\n\n- 3 retries with exponential backoff\n- Max retry interval: 5 minutes\n`,
          status: "in_review",
          versionId: versionIds[4],
          tags: ["notifications", "webhooks"],
          author: "Jen Park",
        },
      ]);
    }
  }
});
