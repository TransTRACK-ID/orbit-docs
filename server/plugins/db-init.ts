import { pool } from "~/server/database";
import { getDb } from "~/server/database";
import { apps, appVersions, activityLogs, docs, owners, workspaceSettings, teamMembers, integrationSettings, notificationSettings, apiKeys, users } from "~/server/database/schema";
import { count } from "drizzle-orm";

export default defineNitroPlugin(async () => {
  try {
    // Test connection first — if DB is unreachable, skip silently
    // so the server can still start (e.g. in preview / Vercel edge builds)
    await pool.query("SELECT 1");
  } catch (err: any) {
    console.warn("[db-init] Database unreachable, skipping initialization:", err.message);
    return;
  }

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
      release_date TIMESTAMP WITH TIME ZONE,
      release_notes TEXT,
      branch TEXT,
      tags TEXT,
      commit_hash TEXT,
      approver TEXT,
      ci_status TEXT NOT NULL DEFAULT 'unknown',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Migrate existing app_versions table with new columns
  await pool.query(`ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS release_date TIMESTAMP WITH TIME ZONE`);
  await pool.query(`ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS release_notes TEXT`);
  await pool.query(`ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS branch TEXT`);
  await pool.query(`ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS tags TEXT`);
  await pool.query(`ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS commit_hash TEXT`);
  await pool.query(`ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS approver TEXT`);
  await pool.query(`ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS ci_status TEXT NOT NULL DEFAULT 'unknown'`);

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

  // Migrate existing docs table with new columns
  await pool.query(`ALTER TABLE docs ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'`);
  await pool.query(`ALTER TABLE docs ADD COLUMN IF NOT EXISTS doc_type TEXT`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS doc_versions (
      id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
      version TEXT NOT NULL,
      content TEXT DEFAULT '',
      title TEXT,
      actor TEXT,
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
  await pool.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`);

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Migrate existing users table that may lack the password column
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT`);

  // doc_generation_jobs table (used by Generate Docs feature)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS doc_generation_jobs (
      id TEXT PRIMARY KEY,
      app_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      repo_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'cloning',
      progress_pct INTEGER NOT NULL DEFAULT 0,
      progress_message TEXT DEFAULT 'Initializing...',
      srs_content TEXT,
      fsd_content TEXT,
      sdd_content TEXT,
      error_message TEXT,
      repo_ref TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      completed_at TIMESTAMP WITH TIME ZONE
    )
  `);

  await pool.query(`ALTER TABLE doc_generation_jobs ADD COLUMN IF NOT EXISTS repo_ref TEXT`);

  // Multi-repo support: jobs can be product-scoped (PRD+FSD+per-repo SDD) or repo-scoped (single SDD)
  await pool.query(`ALTER TABLE doc_generation_jobs ALTER COLUMN repo_url DROP NOT NULL`);
  await pool.query(`ALTER TABLE doc_generation_jobs ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'product'`);
  await pool.query(`ALTER TABLE doc_generation_jobs ADD COLUMN IF NOT EXISTS trigger TEXT NOT NULL DEFAULT 'manual'`);
  await pool.query(`ALTER TABLE doc_generation_jobs ADD COLUMN IF NOT EXISTS repo_id TEXT`);

  // app_repositories table (multiple repositories per app)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_repositories (
      id TEXT PRIMARY KEY,
      app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      repo_url TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'github',
      host_url TEXT,
      default_branch TEXT NOT NULL DEFAULT 'main',
      access_token TEXT,
      webhook_secret TEXT,
      sdd_doc_path TEXT NOT NULL DEFAULT 'docs/SDD.md',
      last_processed_ref TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  // Self-hosted support: host_url for GitHub Enterprise / GitLab Self-Hosted
  await pool.query(`ALTER TABLE app_repositories ADD COLUMN IF NOT EXISTS host_url TEXT`);

  // doc_generation_repo_results table (per-repo SDD results within a job)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS doc_generation_repo_results (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES doc_generation_jobs(id) ON DELETE CASCADE,
      repo_id TEXT REFERENCES app_repositories(id) ON DELETE SET NULL,
      repo_url TEXT NOT NULL,
      repo_ref TEXT,
      sdd_content TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      pr_url TEXT,
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS doc_generation_versions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      content TEXT DEFAULT '',
      actor TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Remove legacy columns from an older schema so the table aligns
  // with the current Drizzle schema (which only uses `password`)
  await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS password_hash`);
  await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS salt`);
  await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS role`);
  await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS email_verified`);

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
      { id: versionIds[0], appId: appIds[0]!, version: "2.4.1", status: "published" as const, createdBy: "Sarah Chen", releaseDate: new Date("2026-05-18"), releaseNotes: "Patch release addressing webhook retry logic and adding support for custom header forwarding in edge routes. No breaking changes.", branch: "release/2.4.1", commitHash: "a7f3c2d", approver: "Sarah Chen", ciStatus: "passed" as const },
      { id: versionIds[1], appId: appIds[0]!, version: "2.4.0", status: "published" as const, createdBy: "Sarah Chen", releaseDate: new Date("2026-05-10"), releaseNotes: "Major feature release with rate limiting improvements and JWT validation middleware.", branch: "release/2.4.0", commitHash: "b8e4d5f", approver: "Sarah Chen", ciStatus: "passed" as const },
      { id: versionIds[2], appId: appIds[1]!, version: "1.8.0", status: "published" as const, createdBy: "Mike Ross", releaseDate: new Date("2026-04-28"), releaseNotes: "OAuth2 provider upgrades and SSO session management fixes.", branch: "release/1.8.0", commitHash: "c9f6e8a", approver: "Mike Ross", ciStatus: "passed" as const },
      { id: versionIds[3], appId: appIds[2]!, version: "3.0.2", status: "published" as const, createdBy: "Sarah Chen", releaseDate: new Date("2026-04-15"), releaseNotes: "Subscription proration bug fix and invoice PDF generation improvements.", branch: "release/3.0.2", commitHash: "d0g7h9b", approver: "Sarah Chen", ciStatus: "passed" as const },
      { id: versionIds[4], appId: appIds[3]!, version: "1.2.5", status: "published" as const, createdBy: "Jen Park", releaseDate: new Date("2026-04-02"), releaseNotes: "Push notification delivery reliability improvements.", branch: "release/1.2.5", commitHash: "e1h8i0c", approver: "Jen Park", ciStatus: "passed" as const },
      { id: versionIds[5], appId: appIds[4]!, version: "4.1.0-rc", status: "rc" as const, createdBy: "Sarah Chen", releaseDate: new Date("2026-03-20"), releaseNotes: "Streaming data processing pipeline v2 with backpressure handling.", branch: "release/4.1.0", commitHash: "f2i9j1d", approver: "Sarah Chen", ciStatus: "pending" as const },
      { id: versionIds[6], appId: appIds[0]!, version: "2.5.0", status: "draft" as const, createdBy: "Sarah Chen", releaseNotes: "Upcoming: GraphQL federation support and caching layer rewrite.", branch: "feat/2.5.0", commitHash: "g3j0k2e", ciStatus: "unknown" as const },
      { id: versionIds[7], appId: appIds[2]!, version: "3.1.0", status: "draft" as const, createdBy: "Mike Ross", releaseNotes: "Upcoming: Multi-currency support and tax engine v2.", branch: "feat/3.1.0", commitHash: "h4k1l3f", ciStatus: "unknown" as const },
    ]);

    const activityIds = Array.from({ length: 5 }, () => crypto.randomUUID());

    await db.insert(activityLogs).values([
      { id: activityIds[0], appId: appIds[0], appName: "API Gateway", action: "Published v2.4.1", actor: "Sarah Chen" },
      { id: activityIds[1], appId: appIds[2], appName: "Billing Engine", action: "Updated docs", actor: "Mike Ross" },
      { id: activityIds[2], appId: appIds[4], appName: "Data Pipeline", action: "Created v4.1.0-rc", actor: "Sarah Chen" },
      { id: activityIds[3], appId: appIds[1], appName: "Auth Service", action: "Published changelog", actor: "Jen Park" },
      { id: activityIds[4], appId: appIds[3], appName: "Notification Service", action: "Draft doc created", actor: "Tom Lee" },
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
          content: `# Webhooks\n\n## Setup\n\nRegister webhook URLs in the dashboard.\n\n## Payload Format\n\n\`\`\`json\n{\n  "event": "message.sent",\n  "payload": { ... }\n}\n\`\`\`\n\n## Retry Policy\n\n- 3 retries with exponential backoff\n- Max retry interval: 5 minutes\n`,
          status: "in_review",
          versionId: versionIds[4],
          tags: ["notifications", "webhooks"],
          author: "Jen Park",
        },
      ]);
    }
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
    const now = new Date();
    await db.insert(teamMembers).values([
      { id: crypto.randomUUID(), name: "Sarah Chen", email: "sarah.chen@example.com", initials: "SC", role: "admin", status: "active", lastActive: "2 hours ago", lastActiveAt: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
      { id: crypto.randomUUID(), name: "Mike Ross", email: "mike.ross@example.com", initials: "MR", role: "product_manager", status: "active", lastActive: "1 day ago", lastActiveAt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      { id: crypto.randomUUID(), name: "Jen Park", email: "jen.park@example.com", initials: "JP", role: "tech_writer", status: "active", lastActive: "3 days ago", lastActiveAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
      { id: crypto.randomUUID(), name: "Tom Lee", email: "tom.lee@example.com", initials: "TL", role: "viewer", status: "active", lastActive: "1 week ago", lastActiveAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      // Preview-mode admin so local testing works out of the box
      { id: crypto.randomUUID(), name: "Preview User", email: "preview@example.com", userId: "preview-user", initials: "PU", role: "admin", status: "active", lastActive: "just now", lastActiveAt: now },
      // Pending invitation for demo / testing
      { id: crypto.randomUUID(), name: "Alex Rivera", email: "alex@example.com", initials: "AR", role: "tech_writer", status: "pending", invitedBy: "Sarah Chen", lastActive: "invited", lastActiveAt: now },
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

  // Seed a default local admin user for out-of-the-box authentication
  const usersCount = await db.select({ count: count() }).from(users);
  if (usersCount[0]?.count === 0) {
    const { hashPassword } = await import("~/server/utils/auth");
    await db.insert(users).values({
      id: "preview-user",
      name: "Preview User",
      email: "preview@example.com",
      password: hashPassword("password123"),
    });
  }
});
