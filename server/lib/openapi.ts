import { parse as parseYaml } from "yaml";
import type {
  NavConfig,
  NavOpenApiOperation,
  NormalizedOpenApi,
  NormalizedOpenApiOperation,
  NormalizedOpenApiParameter,
  NormalizedOpenApiResponse,
} from "~/server/database/schema";

export type OpenApiFormat = "json" | "yaml";

export interface ParsedOpenApiSpec {
  format: OpenApiFormat;
  normalized: NormalizedOpenApi;
}

export class OpenApiParseError extends Error {}

const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;
type HttpMethod = (typeof METHODS)[number];

/** Detect format from content; default to yaml if it starts with `{` -> json. */
export function detectFormat(content: string): OpenApiFormat {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) return "json";
  return "yaml";
}

/** Parse a raw OpenAPI spec string (JSON or YAML) into a normalized structure. */
export function parseOpenApiSpec(content: string, format?: OpenApiFormat): ParsedOpenApiSpec {
  if (!content || !content.trim()) {
    throw new OpenApiParseError("Spec is empty");
  }
  const fmt = format ?? detectFormat(content);
  let raw: unknown;
  try {
    raw = fmt === "json" ? JSON.parse(content) : parseYaml(content);
  } catch (e: any) {
    throw new OpenApiParseError(`Failed to parse ${fmt.toUpperCase()}: ${e?.message || e}`);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new OpenApiParseError("Spec must be an object");
  }
  const spec = raw as Record<string, any>;
  if (!spec.paths || typeof spec.paths !== "object") {
    throw new OpenApiParseError("Spec is missing a valid `paths` object");
  }
  return { format: fmt, normalized: normalizeSpec(spec) };
}

function normalizeSpec(spec: Record<string, any>): NormalizedOpenApi {
  const info = spec.info && typeof spec.info === "object" ? spec.info : {};
  const operations: NormalizedOpenApiOperation[] = [];
  const navOperations: NavOpenApiOperation[] = [];
  const tagOrder: string[] = [];
  const seenSlugs = new Set<string>();

  const paths = spec.paths as Record<string, any>;
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    const sharedParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];
    for (const method of METHODS) {
      const op = pathItem[method];
      if (!op || typeof op !== "object") continue;
      const opId = typeof op.operationId === "string" ? op.operationId : undefined;
      const summary = typeof op.summary === "string" ? op.summary : undefined;
      const tag = Array.isArray(op.tags) && op.tags.length ? String(op.tags[0]) : undefined;
      const slug = makeOperationSlug(opId, method, path, seenSlugs);
      seenSlugs.add(slug);
      const parameters = normalizeParameters([
        ...sharedParams,
        ...(Array.isArray(op.parameters) ? op.parameters : []),
      ]);
      const requestBody = normalizeRequestBody(op.requestBody);
      const responses = normalizeResponses(op.responses);
      const normalizedOp: NormalizedOpenApiOperation = {
        slug,
        operationId: opId,
        method: method.toUpperCase(),
        path,
        tag,
        summary,
        description: typeof op.description === "string" ? op.description : undefined,
        parameters,
        requestBody,
        responses,
        deprecated: op.deprecated === true,
      };
      operations.push(normalizedOp);
      navOperations.push({
        id: slug,
        slug,
        operationId: opId,
        method: method.toUpperCase(),
        path,
        tag,
        label: summary || opId || `${method.toUpperCase()} ${path}`,
      });
      if (tag && !tagOrder.includes(tag)) tagOrder.push(tag);
    }
  }

  const operationBySlug: Record<string, NormalizedOpenApiOperation> = {};
  for (const op of operations) operationBySlug[op.slug] = op;

  return {
    info: {
      title: typeof info.title === "string" ? info.title : undefined,
      version: typeof info.version === "string" ? info.version : undefined,
      description: typeof info.description === "string" ? info.description : undefined,
    },
    operations: navOperations,
    operationBySlug,
    tags: tagOrder,
  };
}

function makeOperationSlug(opId: string | undefined, method: string, path: string, seen: Set<string>): string {
  const source = opId ? opId : `${method} ${path}`;
  const base = slugifyCamel(source);
  let slug = base || "operation";
  let i = 2;
  while (seen.has(slug)) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

/** Slugify that inserts hyphens at camelCase / non-alphanumeric boundaries. */
function slugifyCamel(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeParameters(params: any[]): NormalizedOpenApiParameter[] {
  if (!Array.isArray(params)) return [];
  return params
    .filter((p) => p && typeof p === "object" && typeof p.name === "string")
    .map((p) => {
      const out: NormalizedOpenApiParameter = {
        name: p.name,
        in: typeof p.in === "string" ? p.in : "query",
        required: p.required === true,
      };
      if (typeof p.description === "string") out.description = p.description;
      if (p.schema && typeof p.schema === "object") out.schema = p.schema;
      if (p.example !== undefined) out.example = p.example;
      return out;
    });
}

function normalizeRequestBody(body: any): NormalizedOpenApiOperation["requestBody"] {
  if (!body || typeof body !== "object") return undefined;
  const content = body.content && typeof body.content === "object" ? body.content : {};
  const contentTypes = Object.keys(content).filter((ct) => ct && typeof ct === "string");
  if (contentTypes.length === 0 && !body.description) return undefined;
  let schema: Record<string, unknown> | undefined;
  let example: unknown;
  for (const ct of contentTypes) {
    const media = content[ct];
    if (!media || typeof media !== "object") continue;
    if (!schema && media.schema && typeof media.schema === "object") schema = media.schema;
    if (example === undefined && media.example !== undefined) example = media.example;
  }
  return {
    required: body.required === true,
    description: typeof body.description === "string" ? body.description : undefined,
    contentTypes,
    schema,
    example,
  };
}

function normalizeResponses(responses: any): NormalizedOpenApiResponse[] {
  if (!responses || typeof responses !== "object") return [];
  const out: NormalizedOpenApiResponse[] = [];
  for (const [status, resp] of Object.entries(responses)) {
    if (!resp || typeof resp !== "object") continue;
    const r = resp as Record<string, any>;
    const content = r.content && typeof r.content === "object" ? r.content : {};
    const contentTypes = Object.keys(content);
    let schema: Record<string, unknown> | undefined;
    let example: unknown;
    const examples: Record<string, { summary?: string; value?: unknown }> = {};
    for (const ct of contentTypes) {
      const media = content[ct];
      if (!media || typeof media !== "object") continue;
      if (!schema && media.schema && typeof media.schema === "object") schema = media.schema;
      if (example === undefined && media.example !== undefined) example = media.example;
      if (media.examples && typeof media.examples === "object") {
        for (const [name, ex] of Object.entries(media.examples)) {
          if (ex && typeof ex === "object") {
            examples[name] = {
              summary: typeof (ex as any).summary === "string" ? (ex as any).summary : undefined,
              value: (ex as any).value,
            };
          }
        }
      }
    }
    out.push({
      status,
      description: typeof r.description === "string" ? r.description : undefined,
      contentTypes,
      schema,
      example,
      examples: Object.keys(examples).length ? examples : undefined,
    });
  }
  return out;
}

/** Merge generated openapi nav entries into an existing nav config (replacing prior openapi block). */
export function mergeOpenApiIntoNav(existing: NavConfig | null | undefined, normalized: NormalizedOpenApi): NavConfig {
  const base = existing && typeof existing === "object" ? existing : {};
  return {
    groups: Array.isArray(base.groups) ? base.groups : [],
    pages: Array.isArray(base.pages) ? base.pages : [],
    external: Array.isArray(base.external) ? base.external : [],
    openapi: normalized.operations,
  };
}
