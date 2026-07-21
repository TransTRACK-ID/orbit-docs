import { describe, expect, it } from "vitest";
import {
  parseOpenApiSpec,
  detectFormat,
  mergeOpenApiIntoNav,
  OpenApiParseError,
} from "./openapi";

const SAMPLE = {
  openapi: "3.0.0",
  info: { title: "Demo API", version: "1.0.0" },
  paths: {
    "/users": {
      get: {
        operationId: "listUsers",
        summary: "List users",
        tags: ["Users"],
        parameters: [{ name: "limit", in: "query", schema: { type: "integer" } }],
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { type: "array" } } },
          },
        },
      },
      post: {
        operationId: "createUser",
        summary: "Create user",
        tags: ["Users"],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { type: "object" }, example: { name: "A" } },
          },
        },
        responses: { "201": { description: "Created" } },
      },
    },
    "/health": {
      get: { summary: "Health check", responses: { "200": { description: "OK" } } },
    },
  },
};

describe("detectFormat", () => {
  it("detects json", () => {
    expect(detectFormat('{"x":1}')).toBe("json");
  });
  it("defaults to yaml", () => {
    expect(detectFormat("openapi: 3.0.0")).toBe("yaml");
  });
});

describe("parseOpenApiSpec", () => {
  it("parses a json spec into operations", () => {
    const { normalized } = parseOpenApiSpec(JSON.stringify(SAMPLE));
    expect(normalized.operations).toHaveLength(3);
    expect(normalized.tags).toEqual(["Users"]);
    const list = normalized.operationBySlug["list-users"];
    expect(list).toBeDefined();
    expect(list.method).toBe("GET");
    expect(list.path).toBe("/users");
    expect(list.parameters[0]).toMatchObject({ name: "limit", in: "query" });
  });

  it("parses yaml format", () => {
    const yaml = `
openapi: 3.0.0
info: { title: Y, version: "1" }
paths:
  /x:
    get:
      operationId: getX
      responses:
        "200": { description: ok }
`;
    const { normalized, format } = parseOpenApiSpec(yaml);
    expect(format).toBe("yaml");
    expect(normalized.operations).toHaveLength(1);
    expect(normalized.operationBySlug["get-x"]).toBeDefined();
  });

  it("handles missing operationId by deriving slug from method+path", () => {
    const { normalized } = parseOpenApiSpec(JSON.stringify(SAMPLE));
    expect(normalized.operationBySlug["get-health"]).toBeDefined();
  });

  it("extracts request body and responses", () => {
    const { normalized } = parseOpenApiSpec(JSON.stringify(SAMPLE));
    const create = normalized.operationBySlug["create-user"];
    expect(create.requestBody?.required).toBe(true);
    expect(create.requestBody?.contentTypes).toContain("application/json");
    expect(create.requestBody?.example).toEqual({ name: "A" });
    expect(create.responses.find((r) => r.status === "201")).toBeDefined();
  });

  it("throws on empty spec", () => {
    expect(() => parseOpenApiSpec("")).toThrow(OpenApiParseError);
  });

  it("throws on missing paths", () => {
    expect(() => parseOpenApiSpec('{"info":{}}')).toThrow(OpenApiParseError);
  });

  it("throws on invalid json", () => {
    expect(() => parseOpenApiSpec("{not json", "json")).toThrow(OpenApiParseError);
  });
});

describe("mergeOpenApiIntoNav", () => {
  it("replaces openapi block while preserving other nav", () => {
    const { normalized } = parseOpenApiSpec(JSON.stringify(SAMPLE));
    const existing = {
      groups: [{ id: "g1", label: "Guides", pages: ["intro"] }],
      pages: ["intro"],
      external: [],
      openapi: [{ id: "old", slug: "old", method: "GET", path: "/old", label: "old" }],
    };
    const merged = mergeOpenApiIntoNav(existing, normalized);
    expect(merged.groups).toEqual(existing.groups);
    expect(merged.openapi).toHaveLength(3);
    expect(merged.openapi?.[0]).toMatchObject({ slug: "list-users", method: "GET" });
  });

  it("handles null existing nav", () => {
    const { normalized } = parseOpenApiSpec(JSON.stringify(SAMPLE));
    const merged = mergeOpenApiIntoNav(null, normalized);
    expect(merged.openapi).toHaveLength(3);
    expect(merged.groups).toEqual([]);
  });
});
