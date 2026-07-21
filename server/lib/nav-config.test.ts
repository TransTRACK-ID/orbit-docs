import { describe, expect, it } from "vitest";
import {
  isValidSiteSlug,
  slugify,
  normaliseNavConfig,
  collectReferencedSlugs,
} from "./nav-config";

describe("nav-config", () => {
  describe("isValidSiteSlug", () => {
    it("accepts lowercase hyphenated slugs", () => {
      expect(isValidSiteSlug("getting-started")).toBe(true);
      expect(isValidSiteSlug("api-reference")).toBe(true);
      expect(isValidSiteSlug("v2")).toBe(true);
    });

    it("rejects invalid slugs", () => {
      expect(isValidSiteSlug("Getting Started")).toBe(false);
      expect(isValidSiteSlug("UPPER")).toBe(false);
      expect(isValidSiteSlug("has space")).toBe(false);
      expect(isValidSiteSlug("-leading")).toBe(false);
      expect(isValidSiteSlug("trailing-")).toBe(false);
    });
  });

  describe("slugify", () => {
    it("normalises arbitrary text to a slug", () => {
      expect(slugify("Getting Started!")).toBe("getting-started");
      expect(slugify("  API Reference  ")).toBe("api-reference");
      expect(slugify("v2.1 -- notes")).toBe("v2-1-notes");
    });

    it("returns empty for non-slugifiable input", () => {
      expect(slugify("!!!")).toBe("");
    });
  });

  describe("normaliseNavConfig", () => {
    it("returns empty config for falsy input", () => {
      expect(normaliseNavConfig(null)).toEqual({});
      expect(normaliseNavConfig(undefined)).toEqual({});
      expect(normaliseNavConfig("foo")).toEqual({});
    });

    it("strips invalid entries and keeps valid ones", () => {
      const cfg = normaliseNavConfig({
        pages: ["intro", 123, "quickstart"],
        groups: [
          { id: "g1", label: "Getting Started", pages: ["intro"] },
          { label: "Ok", pages: ["x", 7] },
          { nope: true },
        ],
        external: [
          { id: "e1", label: "GitHub", url: "https://github.com" },
          { label: "no url" },
        ],
      });

      expect(cfg.pages).toEqual(["intro", "quickstart"]);
      expect(cfg.groups).toHaveLength(2);
      expect(cfg.groups![0].pages).toEqual(["intro"]);
      expect(cfg.groups![1].pages).toEqual(["x"]);
      expect(cfg.external).toHaveLength(1);
      expect(cfg.external![0].url).toBe("https://github.com");
    });

    it("assigns ids to groups/external that lack them", () => {
      const cfg = normaliseNavConfig({
        groups: [{ label: "G" }],
        external: [{ label: "L", url: "https://x" }],
      });
      expect(typeof cfg.groups![0].id).toBe("string");
      expect(typeof cfg.external![0].id).toBe("string");
    });
  });

  describe("collectReferencedSlugs", () => {
    it("collects slugs from top-level pages", () => {
      expect(collectReferencedSlugs({ pages: ["a", "b"] }).sort()).toEqual(["a", "b"]);
    });

    it("collects slugs recursively from nested groups", () => {
      const cfg = {
        pages: ["top"],
        groups: [
          { id: "g1", label: "G1", pages: ["g1a"], groups: [{ id: "g2", label: "G2", pages: ["g2a"] }] },
        ],
      };
      expect(collectReferencedSlugs(cfg).sort()).toEqual(["g1a", "g2a", "top"]);
    });
  });
});
