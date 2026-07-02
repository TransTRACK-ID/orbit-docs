import { describe, expect, it } from "vitest";
import { inferFromTitle, extractParentheticalAlias, normalizeAppMatchKey } from "~/server/lib/notion/resolve-app";
import { getPropertyText, type NotionClient, type NotionPage } from "~/server/lib/notion/client";

describe("inferFromTitle", () => {
  it("parses VESMON release titles with space-version format", () => {
    expect(inferFromTitle("🚢VESMON v2.4.0: Elevating Maritime Intelligence")).toEqual({
      appName: "VESMON",
      version: "2.4.0",
    });
    expect(inferFromTitle("🚢 VESMON v2.4.0: Elevating Maritime Intelligence")).toEqual({
      appName: "VESMON",
      version: "2.4.0",
    });
  });

  it("parses colon-version titles", () => {
    expect(inferFromTitle("RegisT Request Visits: v.78.1")).toEqual({
      appName: "RegisT Request Visits",
      version: "78.1",
    });
    expect(inferFromTitle("Bunkering Production: v.1.0")).toEqual({
      appName: "Bunkering Production",
      version: "1.0",
    });
  });

  it("parses app-only colon titles", () => {
    expect(inferFromTitle("🚢 VESMON: Elevating Maritime Intelligence")).toEqual({
      appName: "VESMON",
      version: null,
    });
  });

  it("returns nulls when pattern does not match", () => {
    expect(inferFromTitle("General onboarding guide")).toEqual({
      appName: null,
      version: null,
    });
  });
});

describe("extractParentheticalAlias", () => {
  it("reads alias from parentheses", () => {
    expect(extractParentheticalAlias("Vessel Monitoring (VESMON)")).toBe("VESMON");
  });
});

describe("normalizeAppMatchKey", () => {
  it("strips emoji and normalizes spacing", () => {
    expect(normalizeAppMatchKey("🚢 Vessel Monitoring")).toBe("vessel monitoring");
  });
});

describe("getPropertyText relation", () => {
  it("resolves related page title", async () => {
    const client = {
      getPage: async () =>
        ({
          id: "related",
          properties: {
            Name: { type: "title", title: [{ plain_text: "🚢 Vessel Monitoring" }] },
          },
        }) as NotionPage,
    } as unknown as NotionClient;

    const text = await getPropertyText(client, {
      type: "relation",
      relation: [{ id: "related" }],
    });

    expect(text).toBe("Vessel Monitoring");
  });
});
