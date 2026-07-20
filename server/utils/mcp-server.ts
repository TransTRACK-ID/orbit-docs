import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { eq, desc, sql, and, count } from "drizzle-orm";
import { db } from "~/server/database";
import * as schema from "~/server/database/schema";
import {
  buildGroupedAppDocumentation,
  formatMcpDoc,
  type McpDocRow,
} from "~/server/lib/mcp-doc-payload";
import {
  listFeatureDocIndex,
  searchFeatureDocs,
} from "~/server/lib/feature-doc-search";
import type { DocListView } from "~/utils/doc-display";

function docCategoryCondition(category?: "product" | "knowledge") {
  if (!category) return undefined;
  if (category === "knowledge") {
    return and(
      eq(schema.docs.source, "op_sync"),
      eq(schema.docs.docType, "feature"),
    );
  }
  return sql`NOT (${schema.docs.source} = 'op_sync' AND ${schema.docs.docType} = 'feature')`;
}

/* ------------------------------------------------------------------ */
/* 2. MCP Server Factory                                               */
/* ------------------------------------------------------------------ */

export function createMcpServer() {
  const mcpServer = new Server(
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
  search: z.string().optional(),
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
});

const GetAppSchema = z.object({
  id: z.string(),
});

const ListVersionsSchema = z.object({
  appId: z.string(),
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
});

const GetVersionSchema = z.object({
  appId: z.string(),
  versionId: z.string(),
});

const ListDocsSchema = z.object({
  appId: z.string().optional(),
  status: z.enum(["draft", "in_review", "published", "archived"]).optional(),
  category: z.enum(["product", "knowledge"]).optional(),
  search: z.string().optional(),
  includeContent: z.boolean().optional().default(false),
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
});

const ListAppDocumentationSchema = z.object({
  appId: z.string(),
  view: z.enum(["all", "product", "knowledge"]).optional().default("all"),
});

const SearchFeatureDocsSchema = z.object({
  appId: z.string(),
  query: z.string().optional().default(""),
  module: z.string().optional(),
  limit: z.number().min(1).max(50).optional().default(20),
});

const ListFeatureDocsSchema = z.object({
  appId: z.string(),
  module: z.string().optional(),
  limit: z.number().min(1).max(200).optional().default(100),
});

const GetDocSchema = z.object({
  id: z.string(),
});

const SearchDocsContentSchema = z.object({
  query: z.string(),
  appId: z.string().optional(),
  category: z.enum(["product", "knowledge"]).optional(),
  limit: z.number().min(1).max(20).optional().default(10),
});

const ListReleasesSchema = z.object({
  appId: z.string(),
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
});

const GetReleaseSchema = z.object({
  id: z.string(),
});

const ListChangelogsSchema = z.object({
  appId: z.string(),
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
});

const ListActivitySchema = z.object({
  appId: z.string().optional(),
  limit: z.number().min(1).max(50).optional().default(20),
  offset: z.number().min(0).optional().default(0),
});

const ListOwnersSchema = z.object({
  search: z.string().optional(),
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
});

const GetOwnerSchema = z.object({
  id: z.string(),
});

const GetStatsSchema = z.object({});

/* ------------------------------------------------------------------ */
/* 4. Tool Definitions (JSON Schema)                                   */
/* ------------------------------------------------------------------ */

const TOOLS: Tool[] = [
  {
    name: "list_apps",
    description: "List all applications with name search, pagination, and latest version info.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
  },
  {
    name: "get_app",
    description: "Get detailed app info including version counts, doc counts, recent versions, and activity.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_versions",
    description: "List all versions for an app with release associations.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
      required: ["appId"],
    },
  },
  {
    name: "get_version",
    description: "Get full version details including releases, changelogs, docs, and version history.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string" },
        versionId: { type: "string" },
      },
      required: ["appId", "versionId"],
    },
  },
  {
    name: "list_docs",
    description:
      "List documentation entries with product/knowledge categorization (matches /docs). Product docs include SRS, FSD, SDD, and manuals. Knowledge base entries are synced spreadsheet features (op_sync).",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string" },
        status: { type: "string", enum: ["draft", "in_review", "published", "archived"] },
        category: { type: "string", enum: ["product", "knowledge"] },
        search: { type: "string" },
        includeContent: { type: "boolean" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
  },
  {
    name: "list_app_documentation",
    description:
      "List an app's documentation grouped like the /docs page: Product documentation (SRS, FSD, manuals) and Knowledge base (synced features). Large knowledge bases are summarized instead of listing every row.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string" },
        view: { type: "string", enum: ["all", "product", "knowledge"] },
      },
      required: ["appId"],
    },
  },
  {
    name: "search_feature_docs",
    description:
      "Search the knowledge base (synced spreadsheet features) for an app by title, content, feature ID, or module.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string" },
        query: { type: "string" },
        module: { type: "string" },
        limit: { type: "number" },
      },
      required: ["appId"],
    },
  },
  {
    name: "list_feature_docs",
    description:
      "List knowledge base feature docs for an app (index view). Use when you need feature IDs and titles without full content.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string" },
        module: { type: "string" },
        limit: { type: "number" },
      },
      required: ["appId"],
    },
  },
  {
    name: "get_doc",
    description:
      "Get full doc with content, product/knowledge category, display labels, app, version, available versions, and doc version history.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "search_docs_content",
    description:
      "Full-text search inside doc content (not just titles). Supports product/knowledge filtering to match /docs views.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        appId: { type: "string" },
        category: { type: "string", enum: ["product", "knowledge"] },
        limit: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "list_releases",
    description: "List all releases for an app with version and app info.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
      required: ["appId"],
    },
  },
  {
    name: "get_release",
    description: "Get complete release with features, categories, app info, version details, and related changelogs.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_changelogs",
    description: "List all changelog entries for an app with version associations.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
      required: ["appId"],
    },
  },
  {
    name: "list_activity",
    description: "List recent activity logs across the platform or filtered by app.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
  },
  {
    name: "list_owners",
    description: "List team owners with name search and their associated apps.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
  },
  {
    name: "get_owner",
    description: "Get owner details with all their associated apps.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_stats",
    description: "Get platform-wide statistics (apps, versions, docs, releases, owners).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

/* ------------------------------------------------------------------ */
/* 5. Request Handlers                                                 */
/* ------------------------------------------------------------------ */

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

mcpServer.setRequestHandler(
  CallToolRequestSchema,
  async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
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

        case "list_docs": {
          const params = ListDocsSchema.parse(args);
          const conditions: any[] = [];

          if (params.appId) {
            conditions.push(eq(schema.docs.appId, params.appId));
          }
          if (params.status) {
            conditions.push(eq(schema.docs.status, params.status));
          }
          if (params.category) {
            const categoryCondition = docCategoryCondition(params.category);
            if (categoryCondition) conditions.push(categoryCondition);
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
              source: schema.docs.source,
              docType: schema.docs.docType,
              externalId: schema.docs.externalId,
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

          const data = rows.map((row) =>
            formatMcpDoc(row as McpDocRow, { includeContent: params.includeContent }),
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ data, count: data.length }, null, 2),
              },
            ],
          };
        }

        case "list_app_documentation": {
          const params = ListAppDocumentationSchema.parse(args);

          const app = await db
            .select({ id: schema.apps.id, name: schema.apps.name })
            .from(schema.apps)
            .where(eq(schema.apps.id, params.appId))
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
              id: schema.docs.id,
              appId: schema.docs.appId,
              title: schema.docs.title,
              content: schema.docs.content,
              status: schema.docs.status,
              versionId: schema.docs.versionId,
              tags: schema.docs.tags,
              author: schema.docs.author,
              source: schema.docs.source,
              docType: schema.docs.docType,
              externalId: schema.docs.externalId,
              createdAt: schema.docs.createdAt,
              updatedAt: schema.docs.updatedAt,
              appName: schema.apps.name,
              version: schema.appVersions.version,
            })
            .from(schema.docs)
            .leftJoin(schema.apps, eq(schema.docs.appId, schema.apps.id))
            .leftJoin(schema.appVersions, eq(schema.docs.versionId, schema.appVersions.id))
            .where(eq(schema.docs.appId, params.appId))
            .orderBy(desc(schema.docs.updatedAt));

          const groups = buildGroupedAppDocumentation(
            rows as McpDocRow[],
            params.view as DocListView,
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    data: {
                      app: { id: app.id, name: app.name },
                      view: params.view,
                      groups,
                    },
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        case "search_feature_docs": {
          const params = SearchFeatureDocsSchema.parse(args);

          const app = await db
            .select({ id: schema.apps.id })
            .from(schema.apps)
            .where(eq(schema.apps.id, params.appId))
            .limit(1)
            .then((rows) => rows[0]);

          if (!app) {
            return {
              content: [{ type: "text", text: JSON.stringify({ error: "App not found" }, null, 2) }],
              isError: true,
            };
          }

          const results = await searchFeatureDocs({
            appId: params.appId,
            query: params.query,
            module: params.module,
            limit: params.limit,
          });

          const data = results.map((row) => ({
            id: row.id,
            title: row.title,
            externalId: row.externalId,
            status: row.status,
            tags: row.tags,
            category: "knowledge" as const,
            content: row.content,
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

        case "list_feature_docs": {
          const params = ListFeatureDocsSchema.parse(args);

          const app = await db
            .select({ id: schema.apps.id })
            .from(schema.apps)
            .where(eq(schema.apps.id, params.appId))
            .limit(1)
            .then((rows) => rows[0]);

          if (!app) {
            return {
              content: [{ type: "text", text: JSON.stringify({ error: "App not found" }, null, 2) }],
              isError: true,
            };
          }

          const data = await listFeatureDocIndex({
            appId: params.appId,
            module: params.module,
            limit: params.limit,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ data, count: data.length, category: "knowledge" }, null, 2),
              },
            ],
          };
        }

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
              source: schema.docs.source,
              docType: schema.docs.docType,
              externalId: schema.docs.externalId,
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
                      ...formatMcpDoc(doc as McpDocRow, { includeContent: true }),
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

        case "search_docs_content": {
          const params = SearchDocsContentSchema.parse(args);
          const query = params.query;
          const appId = params.appId;
          const limit = params.limit;

          const searchPattern = "%" + query + "%";
          const conditions = [
            sql`(
              ${schema.docs.content} ILIKE ${searchPattern}
              OR ${schema.docs.title} ILIKE ${searchPattern}
              OR ${schema.docs.externalId} ILIKE ${searchPattern}
            )`,
          ];

          if (appId) {
            conditions.push(eq(schema.docs.appId, appId));
          }

          const categoryCondition = docCategoryCondition(params.category);
          if (categoryCondition) {
            conditions.push(categoryCondition);
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
              source: schema.docs.source,
              docType: schema.docs.docType,
              externalId: schema.docs.externalId,
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

          const data = rows.map((row) =>
            formatMcpDoc(row as McpDocRow, { includeContent: true }),
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ data, count: data.length }, null, 2),
              },
            ],
          };
        }

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

  return mcpServer;
}

export const mcpServer = createMcpServer();

/* ------------------------------------------------------------------ */
/* 6. Auth helper for Nitro                                           */
/* ------------------------------------------------------------------ */

export const MCP_API_KEY = process.env.MCP_API_KEY;

export function checkMcpApiKey(authHeader: string | undefined, apiKeyHeader: string | undefined): boolean {
  // If no MCP_API_KEY is configured, require a key to be set before allowing connections.
  // This prevents accidental open MCP endpoints in production.
  if (!MCP_API_KEY) {
    return false;
  }
  const providedKey = (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : apiKeyHeader) || "";
  return providedKey === MCP_API_KEY;
}

/* ------------------------------------------------------------------ */
/* 7. Transport storage (shared for serverful deployments)              */
/* ------------------------------------------------------------------ */

export const transports: Record<string, any> = {};
