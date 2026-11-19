import { describe, expect, it } from "vitest";
import { dedupePublicReleases } from "./public-releases-list";

describe("dedupePublicReleases", () => {
  it("collapses duplicate empty releases for the same app and day", () => {
    const rows = [
      {
        id: "a",
        appId: "app-1",
        appName: "Bunkering",
        version: "Testing",
        releaseDate: "2026-11-04T00:00:00.000Z",
        createdAt: "2026-11-04T00:00:00.000Z",
        updatedAt: "2026-11-04T10:00:00.000Z",
        heroTitle: "vTesting",
        summary: null,
        categories: { added: [], fixed: [], changed: [], deprecated: [], security: [] },
      },
      {
        id: "b",
        appId: "app-1",
        appName: "Bunkering",
        version: "Testing",
        releaseDate: "2026-11-04T00:00:00.000Z",
        createdAt: "2026-11-04T00:00:00.000Z",
        updatedAt: "2026-11-04T12:00:00.000Z",
        heroTitle: "vTesting",
        summary: null,
        categories: { added: [], fixed: [], security: [], deprecated: [] },
      },
    ];

    const result = dedupePublicReleases(rows);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("b");
  });

  it("keeps releases with content over empty duplicates", () => {
    const rows = [
      {
        id: "empty",
        appId: "app-1",
        appName: "Bunkering",
        version: "1.0.0",
        releaseDate: "2026-11-04T00:00:00.000Z",
        createdAt: null,
        updatedAt: "2026-11-04T12:00:00.000Z",
        heroTitle: null,
        summary: null,
        categories: { added: [], fixed: [] },
      },
      {
        id: "rich",
        appId: "app-1",
        appName: "Bunkering",
        version: "1.0.0",
        releaseDate: "2026-11-04T00:00:00.000Z",
        createdAt: null,
        updatedAt: "2026-11-04T10:00:00.000Z",
        heroTitle: null,
        summary: null,
        categories: { added: ["Widget support"], fixed: [] },
      },
    ];

    expect(dedupePublicReleases(rows)).toHaveLength(1);
    expect(dedupePublicReleases(rows)[0]?.id).toBe("rich");
  });
});