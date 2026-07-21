import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { apps } from "./apps";
import { docs } from "./apps";

export interface NavGroup {
  id: string;
  label: string;
  icon?: string;
  expanded?: boolean;
  pages?: string[];
  groups?: NavGroup[];
  openapi?: string[];
}

export interface NavExternalLink {
  id: string;
  label: string;
  url: string;
  icon?: string;
}

export interface NavOpenApiOperation {
  id: string;
  slug: string;
  operationId?: string;
  method: string;
  path: string;
  tag?: string;
  label: string;
}

export interface NavConfig {
  groups?: NavGroup[];
  pages?: string[];
  external?: NavExternalLink[];
  openapi?: NavOpenApiOperation[];
}

export interface NormalizedOpenApi {
  info?: { title?: string; version?: string; description?: string };
  operations: NavOpenApiOperation[];
  operationBySlug: Record<string, NormalizedOpenApiOperation>;
  tags: string[];
}

export interface NormalizedOpenApiParameter {
  name: string;
  in: string;
  required: boolean;
  description?: string;
  schema?: Record<string, unknown>;
  example?: unknown;
}

export interface NormalizedOpenApiResponse {
  status: string;
  description?: string;
  contentTypes?: string[];
  schema?: Record<string, unknown>;
  example?: unknown;
  examples?: Record<string, { summary?: string; value?: unknown }>;
}

export interface NormalizedOpenApiOperation {
  slug: string;
  operationId?: string;
  method: string;
  path: string;
  tag?: string;
  summary?: string;
  description?: string;
  parameters: NormalizedOpenApiParameter[];
  requestBody?: {
    required: boolean;
    description?: string;
    contentTypes: string[];
    schema?: Record<string, unknown>;
    example?: unknown;
  };
  responses: NormalizedOpenApiResponse[];
  deprecated: boolean;
}

export const docSites = pgTable("doc_sites", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  appId: text("app_id").references(() => apps.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  status: text("status", { enum: ["draft", "published", "archived"] })
    .notNull()
    .default("draft"),
  navConfig: jsonb("nav_config").$type<NavConfig>().default({}),
  openapiSpec: text("openapi_spec"),
  openapiFormat: text("openapi_format", { enum: ["json", "yaml"] }),
  openapiNormalized: jsonb("openapi_normalized").$type<NormalizedOpenApi>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const docSitesRelations = relations(docSites, ({ one, many }) => ({
  app: one(apps, {
    fields: [docSites.appId],
    references: [apps.id],
  }),
  docs: many(docs),
}));
