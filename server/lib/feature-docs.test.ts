import { describe, it, expect } from "vitest";
import {
  buildFeatureMarkdown,
  mapFeatureStatus,
  moduleTag,
  normalizeFeatureRow,
  validateFeatureRow,
} from "./feature-docs";

const sampleFeature = {
  feature_id: "FLT-001",
  module: "Fleet",
  feature_name: "Live GPS Tracking",
  what_is_it: "Real-time vehicle location on a map.",
  who_uses_it: "Fleet managers",
  when_to_use: "When monitoring active deliveries",
  how_to_use: "Open Fleet → Live Map",
  business_rules: "Requires GPS hardware",
  limitations: "5-minute refresh on basic plan",
  related_features: "Geofencing",
  faq: "Q: Offline? A: Buffers locally.",
  sales_pitch: "See your fleet in real time.",
  version: "2.1",
  status: "published",
  last_updated: "2026-07-14",
  author: "Jane Doe",
};

describe("validateFeatureRow", () => {
  it("accepts a complete feature row", () => {
    expect(validateFeatureRow(sampleFeature)).toBeNull();
  });

  it("rejects missing module", () => {
    const result = validateFeatureRow({ ...sampleFeature, module: "" });
    expect(result?.message).toContain("module");
  });

  it("accepts numeric version from spreadsheet cells", () => {
    expect(validateFeatureRow({ ...sampleFeature, version: 2.1 })).toBeNull();
  });

  it("accepts date last_updated from spreadsheet cells", () => {
    expect(
      validateFeatureRow({ ...sampleFeature, last_updated: new Date("2026-07-14") }),
    ).toBeNull();
  });
});

describe("mapFeatureStatus", () => {
  it("maps published synonyms", () => {
    expect(mapFeatureStatus("live").status).toBe("published");
  });

  it("defaults unknown status to draft with warning", () => {
    const result = mapFeatureStatus("unknown");
    expect(result.status).toBe("draft");
    expect(result.warning).toBeDefined();
  });
});

describe("buildFeatureMarkdown", () => {
  it("includes required sections", () => {
    const md = buildFeatureMarkdown(normalizeFeatureRow(sampleFeature));
    expect(md).toContain("# Live GPS Tracking");
    expect(md).toContain("## What is it");
    expect(md).toContain("## Sales pitch");
  });

  it("omits sales pitch when empty", () => {
    const md = buildFeatureMarkdown(
      normalizeFeatureRow({ ...sampleFeature, sales_pitch: "" }),
    );
    expect(md).not.toContain("## Sales pitch");
  });
});

describe("moduleTag", () => {
  it("prefixes module name", () => {
    expect(moduleTag("Fleet")).toBe("module:Fleet");
  });
});
