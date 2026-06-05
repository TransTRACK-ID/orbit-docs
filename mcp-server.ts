import "dotenv/config";
import express from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, sql, and, count, asc } from "drizzle-orm";
import * as schema from "./server/database/schema";

/* ------------------------------------------------------------------ */
/* 1. Database Setup                                                   */
/* ------------------------------------------------------------------ */

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing POSTGRES_URL or DATABASE_URL environment variable");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

/* ------------------------------------------------------------------ */
/* 1b. Auth Middleware                                                  */
/* ------------------------------------------------------------------ */

const MCP_API_KEY = process.env.MCP_API_KEY;

if (MCP_API_KEY) {
  console.log("[orbit-docs-mcp] API key authentication enabled");
} else {
  console.warn("[orbit-docs-mcp] WARNING: MCP_API_KEY not set. Server is open to anyone with the URL.");
  console.warn("[orbit-docs-mcp] Set MCP_API_KEY in your environment to secure the endpoint.");
}

function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Skip auth for health check
  if (req.path === "/health") {
    return next();
  }

  if (!MCP_API_KEY) {
    return next();
  }

  const authHeader = req.headers.authorization || "";
  const apiKey = req.headers["x-api-key"] as string || "";

  const providedKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : apiKey;

  if (!providedKey || providedKey !== MCP_API_KEY) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or missing API key. Provide it via Authorization: Bearer <key> or X-API-Key header.",
    });
  }

  next();
}

/* ------------------------------------------------------------------ */
/* 2. MCP Server                                                       */
/* ------------------------------------------------------------------ */

const server = new Server(
  {
    name: "orbit-docs",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/* ------------------------------------------------------------------ */
/* 3. Zod Schemas for Validation                                       */
/* ------------------------------------------------------------------ */

const ListAppsSchema = z.object({
  search: z.string().optional().describe("Filter apps by name (case-insensitive partial match)"),
  limit: z.number().min(1).max(100).optional().default(50).describe("Maximum number of results (1-100)"),
  offset: z.number().min(0).optional().default(0).describe("Number of results to skip for pagination"),
});

const GetAppSchema = z.object({
  id: z.string().describe("The unique app ID (UUID)"),
});

const ListVersionsSchema = z.object({
  appId: z.string().describe("The app ID to list versions for"),
  limit: z.number().min(1).max(100).optional().default(50).describe("Maximum number of results (1-100)"),
  offset: z.number().min(0).optional().default(0).describe("Number of results to skip for pagination"),
});

const GetVersionSchema = z.object({
  appId: z.string().describe("The app ID the version belongs to"),
  versionId: z.string().describe("The unique version ID (UUID)"),
});

const ListDocsSchema = z.object({
  appId: z.string().optional().describe("Filter docs by app ID"),
  status: z.enum(["draft", "in_review", "published", "archived"]).optional().describe("Filter by doc status"),
  search: z.string().optional().describe("Search in doc titles (case-insensitive partial match)"),
  limit: z.number().min(1).max(100).optional().default(50).describe("Maximum number of results (1-100)"),
  offset: z.number().min(0).optional().default(0).describe("Number of results to skip for pagination"),
});

const GetDocSchema = z.object({
  id: z.string().describe("The unique doc ID (UUID)"),
});

const SearchDocsContentSchema = z.object({
  query: z.string().describe("The search query to find in doc content"),
  appId: z.string().optional().describe("Optional app ID to limit search scope"),
  limit: z.number().min(1).max(20).optional().default(10).describe("Maximum number of results (1-20)"),
});

const ListReleasesSchema = z.object({
  appId: z.string().describe("The app ID to list releases for"),
  limit: z.number().min(1).max(100).optional().default(50).describe("Maximum number of results (1-100)"),
  offset: z.number().min(0).optional().default(0).describe("Number of results to skip for pagination"),
});

const GetReleaseSchema = z.object({
  id: z.string().describe("The unique release ID (UUID)"),
});

const ListChangelogsSchema = z.object({
  appId: z.string().describe("The app ID to list changelogs for"),
  limit: z.number().min(1).max(100).optional().default(50).describe("Maximum number of results (1-100)"),
  offset: z.number().min(0).optional().default(0).describe("Number of results to skip for pagination"),
});

const ListActivitySchema = z.object({
  appId: z.string().optional().describe("Filter activity by app ID"),
  limit: z.number().min(1).max(50).optional().default(20).describe("Maximum number of results (1-50)"),
  offset: z.number().min(0).optional().default(0).describe("Number of results to skip for pagination"),
});

const ListOwnersSchema = z.object({
  search: z.string().optional().describe("Filter owners by name (case-insensitive partial match)"),
  limit: z.number().min(1).max(100).optional().default(50).describe("Maximum number of results (1-100)"),
  offset: z.number().min(0).optional().default(0).describe("Number of results to skip for pagination"),
});

const GetOwnerSchema = z.object({
  id: z.string().describe("The unique owner ID (UUID)"),
});

const GetStatsSchema = z.object({});

/* ------------------------------------------------------------------ */
/* 4. Tool Definitions (JSON Schema)                                   */
/* ------------------------------------------------------------------ */

const TOOLS: Tool[] = [
  {
    name: "list_apps",
    description:
      "List all applications in the Orbit Docs platform. Returns apps with their metadata and latest version info. Supports pagination and name search.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Filter apps by name (case-insensitive partial match)" },
        limit: { type: "number", description: "Maximum number of results (1-100). Default: 50" },
        offset: { type: "number", description: "Number of results to skip for pagination. Default: 0" },
      },
    },
  },
  {
    name: "get_app",
    description:
      "Get detailed information about a single app including its metadata, version counts, doc counts, latest version, and recent activity.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The unique app ID (UUID)" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_versions",
    description:
      "List all versions for a specific app. Returns version metadata with associated release information. Supports pagination.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "The app ID to list versions for" },
        limit: { type: "number", description: "Maximum number of results (1-100). Default: 50" },
        offset: { type: "number", description: "Number of results to skip for pagination. Default: 0" },
      },
      required: ["appId"],
    },
  },
  {
    name: "get_version",
    description:
      "Get detailed information about a specific version including its full metadata, associated releases, app info, and related changelogs.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "The app ID the version belongs to" },
        versionId: { type: "string", description: "The unique version ID (UUID)" },
      },
      required: ["appId", "versionId"],
    },
  },
  {
    name: "list_docs",
    description:
      "List all documentation entries in the platform. Returns docs with app and version info. Supports filtering by app, status, and title search. Supports pagination.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "Filter docs by app ID" },
        status: { type: "string", enum: ["draft", "in_review", "published", "archived"], description: "Filter by doc status" },
        search: { type: "string", description: "Search in doc titles (case-insensitive partial match)" },
        limit: { type: "number", description: "Maximum number of results (1-100). Default: 50" },
        offset: { type: "number", description: "Number of results to skip for pagination. Default: 0" },
      },
    },
  },
  {
    name: "get_doc",
    description:
      "Get full details of a single documentation entry including its content, metadata, associated app, version, and all available app versions for this doc.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The unique doc ID (UUID)" },
      },
      required: ["id"],
    },
  },
  {
    name: "search_docs_content",
    description:
      "Search inside documentation content (not just titles) for a specific query. Useful for finding information within documents. Returns matching docs with their full content.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query to find in doc content" },
        appId: { type: "string", description: "Optional app ID to limit search scope" },
        limit: { type: "number", description: "Maximum number of results (1-20). Default: 10" },
      },
      required: ["query"],
    },
  },
  {
    name: "list_releases",
    description:
      "List all release notes for a specific app. Returns releases with their metadata, features, and categories. Supports pagination.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "The app ID to list releases for" },
        limit: { type: "number", description: "Maximum number of results (1-100). Default: 50" },
        offset: { type: "number", description: "Number of results to skip for pagination. Default: 0" },
      },
      required: ["appId"],
    },
  },
  {
    name: "get_release",
    description:
      "Get detailed information about a single release including its full feature list, category breakdown (added/fixed/changed/deprecated/security), app info, and version details.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The unique release ID (UUID)" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_changelogs",
    description:
      "List all changelog entries for a specific app. Returns changelogs with their version association. Supports pagination.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "The app ID to list changelogs for" },
        limit: { type: "number", description: "Maximum number of results (1-100). Default: 50" },
        offset: { type: "number", description: "Number of results to skip for pagination. Default: 0" },
      },
      required: ["appId"],
    },
  },
  {
    name: "list_activity",
    description:
      "List recent activity logs across the platform or filtered by a specific app. Returns actions, actors, and timestamps. Supports pagination.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "Filter activity by app ID" },
        limit: { type: "number", description: "Maximum number of results (1-50). Default: 20" },
        offset: { type: "number", description: "Number of results to skip for pagination. Default: 0" },
      },
    },
  },
  {
    name: "list_owners",
    description:
      "List all team owners in the platform. Supports name search and pagination.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Filter owners by name (case-insensitive partial match)" },
        limit: { type: "number", description: "Maximum number of results (1-100). Default: 50" },
        offset: { type: "number", description: "Number of results to skip for pagination. Default: 0" },
      },
    },
  },
  {
    name: "get_owner",
    description:
      "Get detailed information about a single owner including their metadata and associated apps.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The unique owner ID (UUID)" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_stats",
    description:
      "Get platform-wide statistics including active apps count, total versions, published docs, and draft versions.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

/* ------------------------------------------------------------------ */
/* 5. Request Handlers                                                 */
/* ------------------------------------------------------------------ */

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(
  CallToolRequestSchema,
  async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        /* ----------------------- list_apps ----------------------- */
        case "list_apps": {
          const params = ListAppsSchema.parse(args);
          const search = params.search || "";
          const limit = params.limit;
          const offset = params.offset;

          const conditions = search
            ? sql`${schema.apps.name} ILIKE ${"%" + search + "%"}`
            : undefined;

          const allApps = await db
            .select({
              id: schema.apps.id,
              name: schema.apps.name,
              description: schema.apps.description,
              owner: schema.apps.owner,
              status: schema.apps.status,
              repoUrl: schema.apps.repoUrl,
              createdAt: schema.apps.createdAt,
              updatedAt: schema.apps.updatedAt,
            })
            .from(schema.apps)
            .where(conditions)
            .orderBy(desc(schema.apps.updatedAt))
            .limit(limit)
            .offset(offset);

          const appsWithVersions = await Promise.all(
            allApps.map(async (app) => {
              const latestVersion = await db
                .select()
                .from(schema.appVersions)
                .where(eq(schema.appVersions.appId, app.id))
                .orderBy(desc(schema.appVersions.releaseDate), desc(schema.appVersions.createdAt))
                .limit(1)
                .then((rows) => rows[0] || null);

              const versionCount = await db
                .select({ count: count() })
                .from(schema.appVersions)
                .where(eq(schema.appVersions.appId, app.id))
                .then((rows) => rows[0]?.count ?? 0);

              const docCount = await db
                .select({ count: count() })
                .from(schema.docs)
                .where(eq(schema.docs.appId, app.id))
                .then((rows) => rows[0]?.count ?? 0);

              return {
                ...app,
                versionCount,
                docCount,
                latestVersion: latestVersion
                  ? {
                      id: latestVersion.id,
                      version: latestVersion.version,
                      status: latestVersion.status,
                      createdBy: latestVersion.createdBy,
                      createdAt: latestVersion.createdAt,
                      releaseDate: latestVersion.releaseDate,
                    }
                  : null,
              };
            })
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ data: appsWithVersions, count: appsWithVersions.length }, null, 2),
              },
            ],
          };
        }

        /* ----------------------- get_app ----------------------- */
        case "get_app": {
          const params = GetAppSchema.parse(args);
          const id = params.id;

          const app = await db
            .select({
              id: schema.apps.id,
              name: schema.apps.name,
              description: schema.apps.description,
              owner: schema.apps.owner,
              status: schema.apps.status,
              repoUrl: schema.apps.repoUrl,
              createdAt: schema.apps.createdAt,
              updatedAt: schema.apps.updatedAt,
            })
            .from(schema.apps)
            .where(eq(schema.apps.id, id))
            .limit(1)
            .then((rows) => rows[0]);

          if (!app) {
            return {
              content: [{ type: "text", text: JSON.stringify({ error: "App not found" }, null, 2) }],
              isError: true,
            };
          }

          const [latestVersion, versionCount, docCount, publishedDocCount, recentVersions, recentActivity] =
            await Promise.all([
              db
                .select()
                .from(schema.appVersions)
                .where(eq(schema.appVersions.appId, id))
                .orderBy(desc(schema.appVersions.createdAt))
                .limit(1)
                .then((rows) => rows[0] || null),
              db
                .select({ count: count() })
                .from(schema.appVersions)
                .where(eq(schema.appVersions.appId, id))
                .then((rows) => rows[0]?.count ?? 0),
              db
                .select({ count: count() })
                .from(schema.docs)
                .where(eq(schema.docs.appId, id))
                .then((rows) => rows[0]?.count ?? 0),
              db
                .select({ count: count() })
                .from(schema.docs)
                .where(and(eq(schema.docs.appId, id), eq(schema.docs.status, "published")))
                .then((rows) => rows[0]?.count ?? 0),
              db
                .select({
                  id: schema.appVersions.id,
                  version: schema.appVersions.version,
                  status: schema.appVersions.status,
                  releaseDate: schema.appVersions.releaseDate,
                })
                .from(schema.appVersions)
                .where(eq(schema.appVersions.appId, id))
                .orderBy(desc(schema.appVersions.createdAt))
                .limit(5),
              db
                .select()
                .from(schema.activityLogs)
                .where(eq(schema.activityLogs.appId, id))
                .orderBy(desc(schema.activityLogs.createdAt))
                .limit(10),
            ]);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    data: {
                      ...app,
                      latestVersion: latestVersion
                        ? {
                            id: latestVersion.id,
                            version: latestVersion.version,
                            status: latestVersion.status,
                            createdBy: latestVersion.createdBy,
                            createdAt: latestVersion.createdAt,
                            releaseDate: latestVersion.releaseDate,
                          }
                        : null,
                      versionCount,
                      docCount,
                      publishedDocCount,
                      recentVersions,
                      recentActivity,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        /* ----------------------- list_versions ----------------------- */
        case "list_versions": {
          const params = ListVersionsSchema.parse(args);
          const id = params.appId;
          const limit = params.limit;
          const offset = params.offset;

          const app = await db
            .select({ id: schema.apps.id })
            .from(schema.apps)
            .where(eq(schema.apps.id, id))
            .limit(1)
            .then((rows) => rows[0]);

          if (!app) {
            return {
              content: [{ type: "text", text: JSON.stringify({ error: "App not found" }, null, 2) }],
              isError: true,
            };
          }

          const versions = await db
            .select()
            .from(schema.appVersions)
            .where(eq(schema.appVersions.appId, id))
            .orderBy(desc(schema.appVersions.createdAt))
            .limit(limit)
            .offset(offset);

          const releaseRows = await db
            .select({
              versionId: schema.releases.versionId,
              id: schema.releases.id,
              type: schema.releases.type,
              published: schema.releases.published,
            })
            .from(schema.releases)
            .where(eq(schema.releases.appId, id));

          const releasesByVersion = new Map<string, Array<{ id: string; type: string; published: boolean }>>();
          for (const r of releaseRows) {
            const list = releasesByVersion.get(r.versionId) || [];
            list.push({ id: r.id, type: r.type, published: r.published });
            releasesByVersion.set(r.versionId, list);
          }

          const data = versions.map((v) => ({
            ...v,
            releases: releasesByVersion.get(v.id) || [],
            releasePublished: releasesByVersion.get(v.id)?.some((r) => r.published) || false,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ data, count: data.length }, null, 2),
              },
            ],
          };
        }

        /* ----------------------- get_version ----------------------- */
        case "get_version": {
          const params = GetVersionSchema.parse(args);
          const appId = params.appId;
          const versionId = params.versionId;

          const row = await db
            .select({
              id: schema.appVersions.id,
              appId: schema.appVersions.appId,
              version: schema.appVersions.version,
              status: schema.appVersions.status,
              createdBy: schema.appVersions.createdBy,
              releaseDate: schema.appVersions.releaseDate,
              releaseNotes: schema.appVersions.releaseNotes,
              branch: schema.appVersions.branch,
              tags: schema.appVersions.tags,
              commitHash: schema.appVersions.commitHash,
              approver: schema.appVersions.approver,
              ciStatus: schema.appVersions.ciStatus,
              createdAt: schema.appVersions.createdAt,
              updatedAt: schema.appVersions.updatedAt,
              appName: schema.apps.name,
            })
            .from(schema.appVersions)
            .innerJoin(schema.apps, eq(schema.appVersions.appId, schema.apps.id))
            .where(eq(schema.appVersions.id, versionId))
            .limit(1)
            .then((rows) => rows[0]);

          if (!row) {
            return {
              content: [{ type: "text", text: JSON.stringify({ error: "Version not found" }, null, 2) }],
              isError: true,
            };
          }

          if (row.appId !== appId) {
            return {
              content: [{ type: "text", text: JSON.stringify({ error: "Version does not belong to this app" }, null, 2) }],
              isError: true,
            };
          }

          const [releasesForVersion, changelogsForVersion, docsForVersion, versionHistory] = await Promise.all([
            db
              .select()
              .from(schema.releases)
              .where(eq(schema.releases.versionId, versionId))
              .orderBy(desc(schema.releases.createdAt)),
            db
              .select({
                id: schema.changelogs.id,
                title: schema.changelogs.title,
                content: schema.changelogs.content,
                status: schema.changelogs.status,
                createdBy: schema.changelogs.createdBy,
                createdAt: schema.changelogs.createdAt,
              })
              .from(schema.changelogs)
              .where(eq(schema.changelogs.versionId, versionId))
              .orderBy(desc(schema.changelogs.createdAt)),
            db
              .select({
                id: schema.docs.id,
                title: schema.docs.title,
                status: schema.docs.status,
                author: schema.docs.author,
                createdAt: schema.docs.createdAt,
              })
              .from(schema.docs)
              .where(eq(schema.docs.versionId, versionId))
              .orderBy(desc(schema.docs.createdAt)),
            db
              .select()
              .from(schema.versionHistory)
              .where(eq(schema.versionHistory.versionId, versionId))
              .orderBy(desc(schema.versionHistory.createdAt))
              .limit(10),
          ]);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    data: {
                      ...row,
                      releases: releasesForVersion,
                      changelogs: changelogsForVersion,
                      docs: docsForVersion,
                      versionHistory,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        /* ----------------------- list_docs ----------------------- */
        case "list_docs": {
          const params = ListDocsSchema.parse(args);
          const conditions: any[] = [];

          if (params.appId) {
            conditions.push(eq(schema.docs.appId, params.appId));
          }
          if (params.status) {
            conditions.push(eq(schema.docs.status, params.status));
          }
          if (params.search) {
            conditions.push(sql`${schema.docs.title} ILIKE ${"%" + params.search + "%"}`);
          }

          const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

          const rows = await db
            .select({
              id: schema.docs.id,
              appId: schema.docs.appId,
              title: schema.docs.title,
              content: schema.docs.content,
              status: schema.docs.status,
              versionId: schema.docs.versionId,
              tags: schema.docs.tags,
              author: schema.docs.author,
              createdAt: schema.docs.createdAt,
              updatedAt: schema.docs.updatedAt,
              appName: schema.apps.name,
              version: schema.appVersions.version,
            })
            .from(schema.docs)
            .leftJoin(schema.apps, eq(schema.docs.appId, schema.apps.id))
            .leftJoin(schema.appVersions, eq(schema.docs.versionId, schema.appVersions.id))
            .where(whereClause)
            .orderBy(desc(schema.docs.updatedAt))
            .limit(params.limit)
            .offset(params.offset);

          const data = rows.map((row) => ({
            id: row.id,
            appId: row.appId,
            title: row.title,
            content: row.content,
            status: row.status,
            versionId: row.versionId,
            tags: row.tags,
            author: row.author,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            app: row.appName ? { id: row.appId, name: row.appName } : null,
            version: row.version ? { id: row.versionId, version: row.version } : null,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ data, count: data.length }, null, 2),
              },
            ],
          };
        }

        /* ----------------------- get_doc ----------------------- */
        case "get_doc": {
          const params = GetDocSchema.parse(args);
          const id = params.id;

          const rows = await db
            .select({
              id: schema.docs.id,
              appId: schema.docs.appId,
              title: schema.docs.title,
              content: schema.docs.content,
              status: schema.docs.status,
              versionId: schema.docs.versionId,
              tags: schema.docs.tags,
              author: schema.docs.author,
              createdAt: schema.docs.createdAt,
              updatedAt: schema.docs.updatedAt,
              appName: schema.apps.name,
              version: schema.appVersions.version,
            })
            .from(schema.docs)
            .leftJoin(schema.apps, eq(schema.docs.appId, schema.apps.id))
            .leftJoin(schema.appVersions, eq(schema.docs.versionId, schema.appVersions.id))
            .where(eq(schema.docs.id, id))
            .limit(1);

          const doc = rows[0] || null;

          if (!doc) {
            return {
              content: [{ type: "text", text: JSON.stringify({ error: "Doc not found" }, null, 2) }],
              isError: true,
            };
          }

          const allVersions = doc.appId
            ? await db
                .select({
                  id: schema.appVersions.id,
                  version: schema.appVersions.version,
                  status: schema.appVersions.status,
                })
                .from(schema.appVersions)
                .where(eq(schema.appVersions.appId, doc.appId))
                .orderBy(desc(schema.appVersions.createdAt))
            : [];

          const docVersions = await db
            .select()
            .from(schema.docVersions)
            .where(eq(schema.docVersions.docId, id))
            .orderBy(desc(schema.docVersions.createdAt));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    data: {
                      ...doc,
                      app: doc.appName ? { id: doc.appId, name: doc.appName } : null,
                      version: doc.version ? { id: doc.versionId, version: doc.version } : null,
                      appVersions: allVersions,
                      docVersions,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        /* ----------------------- search_docs_content ----------------------- */
        case "search_docs_content": {
          const params = SearchDocsContentSchema.parse(args);
          const query = params.query;
          const appId = params.appId;
          const limit = params.limit;

          const searchPattern = "%" + query + "%";
          const conditions = [sql`${schema.docs.content} ILIKE ${searchPattern}`];

          if (appId) {
            conditions.push(eq(schema.docs.appId, appId));
          }

          const rows = await db
            .select({
              id: schema.docs.id,
              appId: schema.docs.appId,
              title: schema.docs.title,
              content: schema.docs.content,
              status: schema.docs.status,
              versionId: schema.docs.versionId,
              tags: schema.docs.tags,
              author: schema.docs.author,
              createdAt: schema.docs.createdAt,
              updatedAt: schema.docs.updatedAt,
              appName: schema.apps.name,
              version: schema.appVersions.version,
            })
            .from(schema.docs)
            .leftJoin(schema.apps, eq(schema.docs.appId, schema.apps.id))
            .leftJoin(schema.appVersions, eq(schema.docs.versionId, schema.appVersions.id))
            .where(and(...conditions))
            .limit(limit);

          const data = rows.map((row) => ({
            id: row.id,
            appId: row.appId,
            title: row.title,
            content: row.content,
            status: row.status,
            versionId: row.versionId,
            tags: row.tags,
            author: row.author,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            app: row.appName ? { id: row.appId, name: row.appName } : null,
            version: row.version ? { id: row.versionId, version: row.version } : null,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ data, count: data.length }, null, 2),
              },
            ],
          };
        }

        /* ----------------------- list_releases ----------------------- */
        case "list_releases": {
          const params = ListReleasesSchema.parse(args);
          const id = params.appId;
          const limit = params.limit;
          const offset = params.offset;

          const app = await db
            .select({ id: schema.apps.id })
            .from(schema.apps)
            .where(eq(schema.apps.id, id))
            .limit(1)
            .then((rows) => rows[0]);

          if (!app) {
            return {
              content: [{ type: "text", text: JSON.stringify({ error: "App not found" }, null, 2) }],
              isError: true,
            };
          }

          const rows = await db
            .select({
              id: schema.releases.id,
              appId: schema.releases.appId,
              versionId: schema.releases.versionId,
              heroTitle: schema.releases.heroTitle,
              summary: schema.releases.summary,
              features: schema.releases.features,
              categories: schema.releases.categories,
              type: schema.releases.type,
              published: schema.releases.published,
              createdAt: schema.releases.createdAt,
              updatedAt: schema.releases.updatedAt,
              appName: schema.apps.name,
              version: schema.appVersions.version,
              releaseDate: schema.appVersions.releaseDate,
              createdBy: schema.appVersions.createdBy,
              versionStatus: schema.appVersions.status,
            })
            .from(schema.releases)
            .innerJoin(schema.apps, eq(schema.releases.appId, schema.apps.id))
            .innerJoin(schema.appVersions, eq(schema.releases.versionId, schema.appVersions.id))
            .where(eq(schema.releases.appId, id))
            .orderBy(desc(schema.appVersions.releaseDate))
            .limit(limit)
            .offset(offset);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ data: rows, count: rows.length }, null, 2),
              },
            ],
          };
        }

        /* ----------------------- get_release ----------------------- */
        case "get_release": {
          const params = GetReleaseSchema.parse(args);
          const id = params.id;

          const rows = await db
            .select({
              id: schema.releases.id,
              appId: schema.releases.appId,
              versionId: schema.releases.versionId,
              heroTitle: schema.releases.heroTitle,
              summary: schema.releases.summary,
              features: schema.releases.features,
              categories: schema.releases.categories,
              type: schema.releases.type,
              published: schema.releases.published,
              createdAt: schema.releases.createdAt,
              updatedAt: schema.releases.updatedAt,
              appName: schema.apps.name,
              version: schema.appVersions.version,
              releaseDate: schema.appVersions.releaseDate,
              createdBy: schema.appVersions.createdBy,
              versionStatus: schema.appVersions.status,
              releaseNotes: schema.appVersions.releaseNotes,
              branch: schema.appVersions.branch,
              commitHash: schema.appVersions.commitHash,
            })
            .from(schema.releases)
            .innerJoin(schema.apps, eq(schema.releases.appId, schema.apps.id))
            .innerJoin(schema.appVersions, eq(schema.releases.versionId, schema.appVersions.id))
            .where(eq(schema.releases.id, id))
            .limit(1);

          const release = rows[0];

          if (!release) {
            return {
              content: [{ type: "text", text: JSON.stringify({ error: "Release not found" }, null, 2) }],
              isError: true,
            };
          }

          const relatedChangelogs = await db
            .select({
              id: schema.changelogs.id,
              title: schema.changelogs.title,
              content: schema.changelogs.content,
              status: schema.changelogs.status,
              createdBy: schema.changelogs.createdBy,
              createdAt: schema.changelogs.createdAt,
            })
            .from(schema.changelogs)
            .where(eq(schema.changelogs.versionId, release.versionId))
            .orderBy(desc(schema.changelogs.createdAt));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    data: {
                      ...release,
                      relatedChangelogs,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        /* ----------------------- list_changelogs ----------------------- */
        case "list_changelogs": {
          const params = ListChangelogsSchema.parse(args);
          const id = params.appId;
          const limit = params.limit;
          const offset = params.offset;

          const rows = await db
            .select({
              id: schema.changelogs.id,
              appId: schema.changelogs.appId,
              versionId: schema.changelogs.versionId,
              title: schema.changelogs.title,
              content: schema.changelogs.content,
              status: schema.changelogs.status,
              createdBy: schema.changelogs.createdBy,
              createdAt: schema.changelogs.createdAt,
              updatedAt: schema.changelogs.updatedAt,
              version: schema.appVersions.version,
            })
            .from(schema.changelogs)
            .leftJoin(schema.appVersions, eq(schema.changelogs.versionId, schema.appVersions.id))
            .where(eq(schema.changelogs.appId, id))
            .orderBy(desc(schema.changelogs.updatedAt))
            .limit(limit)
            .offset(offset);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ data: rows, count: rows.length }, null, 2),
              },
            ],
          };
        }

        /* ----------------------- list_activity ----------------------- */
        case "list_activity": {
          const params = ListActivitySchema.parse(args);
          const conditions = [];

          if (params.appId) {
            conditions.push(eq(schema.activityLogs.appId, params.appId));
          }

          const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

          const logs = await db
            .select()
            .from(schema.activityLogs)
            .where(whereClause)
            .orderBy(desc(schema.activityLogs.createdAt))
            .limit(params.limit)
            .offset(params.offset);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ data: logs, count: logs.length }, null, 2),
              },
            ],
          };
        }

        /* ----------------------- list_owners ----------------------- */
        case "list_owners": {
          const params = ListOwnersSchema.parse(args);
          const search = params.search || "";
          const limit = params.limit;
          const offset = params.offset;

          const conditions = search
            ? sql`${schema.owners.name} ILIKE ${"%" + search + "%"}`
            : undefined;

          const allOwners = await db
            .select({
              id: schema.owners.id,
              name: schema.owners.name,
              email: schema.owners.email,
              role: schema.owners.role,
              createdAt: schema.owners.createdAt,
              updatedAt: schema.owners.updatedAt,
            })
            .from(schema.owners)
            .where(conditions)
            .orderBy(desc(schema.owners.updatedAt))
            .limit(limit)
            .offset(offset);

          const ownersWithApps = await Promise.all(
            allOwners.map(async (owner) => {
              const appsForOwner = await db
                .select({
                  id: schema.apps.id,
                  name: schema.apps.name,
                  status: schema.apps.status,
                })
                .from(schema.apps)
                .where(eq(schema.apps.owner, owner.id))
                .orderBy(desc(schema.apps.updatedAt))
                .limit(5);

              return {
                ...owner,
                apps: appsForOwner,
              };
            })
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ data: ownersWithApps, count: ownersWithApps.length }, null, 2),
              },
            ],
          };
        }

        /* ----------------------- get_owner ----------------------- */
        case "get_owner": {
          const params = GetOwnerSchema.parse(args);
          const id = params.id;

          const owner = await db
            .select({
              id: schema.owners.id,
              name: schema.owners.name,
              email: schema.owners.email,
              role: schema.owners.role,
              createdAt: schema.owners.createdAt,
              updatedAt: schema.owners.updatedAt,
            })
            .from(schema.owners)
            .where(eq(schema.owners.id, id))
            .limit(1)
            .then((rows) => rows[0]);

          if (!owner) {
            return {
              content: [{ type: "text", text: JSON.stringify({ error: "Owner not found" }, null, 2) }],
              isError: true,
            };
          }

          const appsForOwner = await db
            .select({
              id: schema.apps.id,
              name: schema.apps.name,
              description: schema.apps.description,
              status: schema.apps.status,
              repoUrl: schema.apps.repoUrl,
              createdAt: schema.apps.createdAt,
              updatedAt: schema.apps.updatedAt,
            })
            .from(schema.apps)
            .where(eq(schema.apps.owner, id))
            .orderBy(desc(schema.apps.updatedAt));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    data: {
                      ...owner,
                      apps: appsForOwner,
                      appCount: appsForOwner.length,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        /* ----------------------- get_stats ----------------------- */
        case "get_stats": {
          const [activeAppsResult, totalVersionsResult, publishedDocsResult, draftVersionsResult, totalAppsResult, totalDocsResult, totalReleasesResult, totalOwnersResult] =
            await Promise.all([
              db.select({ count: count() }).from(schema.apps).where(eq(schema.apps.status, "active")),
              db.select({ count: count() }).from(schema.appVersions),
              db.select({ count: count() }).from(schema.docs).where(eq(schema.docs.status, "published")),
              db.select({ count: count() }).from(schema.appVersions).where(eq(schema.appVersions.status, "draft")),
              db.select({ count: count() }).from(schema.apps),
              db.select({ count: count() }).from(schema.docs),
              db.select({ count: count() }).from(schema.releases),
              db.select({ count: count() }).from(schema.owners),
            ]);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    data: {
                      activeApps: activeAppsResult[0]?.count ?? 0,
                      totalApps: totalAppsResult[0]?.count ?? 0,
                      totalVersions: totalVersionsResult[0]?.count ?? 0,
                      publishedDocs: publishedDocsResult[0]?.count ?? 0,
                      totalDocs: totalDocsResult[0]?.count ?? 0,
                      draftVersions: draftVersionsResult[0]?.count ?? 0,
                      totalReleases: totalReleasesResult[0]?.count ?? 0,
                      totalOwners: totalOwnersResult[0]?.count ?? 0,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        default:
          return {
            content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }, null, 2) }],
            isError: true,
          };
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: error.message || "Internal error", details: error }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }
);

/* ------------------------------------------------------------------ */
/* 6. HTTP Server with SSE Transport                                   */
/* ------------------------------------------------------------------ */

const app = express();
app.use(cors());
app.use(express.json());
app.use(requireApiKey);

const transports: Record<string, SSEServerTransport> = {};

app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "orbit-docs-mcp", version: "1.0.0" });
});

app.get("/mcp", async (_req, res) => {
  const transport = new SSEServerTransport("/mcp/message", res);
  transports[transport.sessionId] = transport;
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  await server.connect(transport);
});

app.post("/mcp/message", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).json({ error: "No transport found for sessionId" });
  }
});

const PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 41244;

app.listen(PORT, () => {
  console.log(`[orbit-docs-mcp] Server running on http://localhost:${PORT}/mcp`);
  console.log(`[orbit-docs-mcp] Health check: http://localhost:${PORT}/health`);
  console.log(`[orbit-docs-mcp] Connected to database`);
});
