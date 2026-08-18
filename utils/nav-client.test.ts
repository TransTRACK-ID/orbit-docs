import { describe, expect, it } from "vitest";
import {
  collectReferencedSlugs,
  resolveFallbackPageSlugs,
  resolvePagesSectionSlugs,
  unlistedPublishedSlugs,
} from "./nav-client";

const pages = [
  { slug: "intro", title: "Intro" },
  { slug: "create-area", title: "Create Area" },
];

describe("nav-client", () => {
  describe("resolveFallbackPageSlugs", () => {
    it("returns all published pages when nav config is empty", () => {
      expect(resolveFallbackPageSlugs(null, pages)).toEqual(["intro", "create-area"]);
      expect(resolveFallbackPageSlugs({}, pages)).toEqual(["intro", "create-area"]);
    });

    it("returns all published pages when nav groups exist but have no page slugs", () => {
      expect(
        resolveFallbackPageSlugs({ groups: [{ id: "g1", label: "Docs", pages: [] }] }, pages),
      ).toEqual(["intro", "create-area"]);
    });

    it("returns all published pages when nav references unknown slugs only", () => {
      expect(
        resolveFallbackPageSlugs({ pages: ["missing", "also-missing"] }, pages),
      ).toEqual(["intro", "create-area"]);
    });

    it("returns empty when nav references at least one published page", () => {
      expect(resolveFallbackPageSlugs({ pages: ["intro"] }, pages)).toEqual([]);
      expect(
        resolveFallbackPageSlugs({ groups: [{ id: "g1", label: "G", pages: ["create-area"] }] }, pages),
      ).toEqual([]);
    });
  });

  describe("unlistedPublishedSlugs", () => {
    it("returns pages not in nav config", () => {
      expect(unlistedPublishedSlugs({ pages: ["intro"] }, pages)).toEqual(["create-area"]);
    });

    it("returns empty when fallback would be used", () => {
      expect(unlistedPublishedSlugs({}, pages)).toEqual(["intro", "create-area"]);
    });
  });

  describe("collectReferencedSlugs", () => {
    it("collects nested group slugs", () => {
      expect(
        collectReferencedSlugs({
          groups: [{ id: "g1", label: "G", pages: ["a"], groups: [{ id: "g2", label: "S", pages: ["b"] }] }],
        }).sort(),
      ).toEqual(["a", "b"]);
    });
  });

  describe("resolvePagesSectionSlugs", () => {
    it("hides Overview from Pages when it is already in a group", () => {
      const wikiPages = [
        { slug: "1-overview", title: "Overview" },
        { slug: "2-api", title: "API" },
      ];
      expect(
        resolvePagesSectionSlugs(
          {
            pages: ["1-overview"],
            groups: [{ id: "core", label: "Core", pages: ["1-overview", "2-api"] }],
          },
          wikiPages,
        ),
      ).toEqual([]);
    });

    it("keeps ungrouped top-level pages in the Pages section", () => {
      const wikiPages = [
        { slug: "1-overview", title: "Overview" },
        { slug: "9-notes", title: "Notes" },
      ];
      expect(
        resolvePagesSectionSlugs(
          {
            pages: ["9-notes"],
            groups: [{ id: "core", label: "Core", pages: ["1-overview"] }],
          },
          wikiPages,
        ),
      ).toEqual(["9-notes"]);
    });
  });
});
