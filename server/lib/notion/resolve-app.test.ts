import { describe, expect, it } from "vitest";
import { inferFromTitle } from "~/server/lib/notion/resolve-app";

describe("inferFromTitle", () => {
  it("parses VESMON release titles", () => {
    expect(inferFromTitle("🚢VESMON v2.4.0: Elevating Maritime Intelligence")).toEqual({
      appName: "VESMON",
      version: "2.4.0",
    });
    expect(inferFromTitle("🚢 VESMON v2.4.0: Elevating Maritime Intelligence")).toEqual({
      appName: "VESMON",
      version: "2.4.0",
    });
    expect(inferFromTitle("🚢VESMON v2.3.0: Enterprise Readiness & Open Connectivity")).toEqual({
      appName: "VESMON",
      version: "2.3.0",
    });
  });

  it("returns nulls when pattern does not match", () => {
    expect(inferFromTitle("General onboarding guide")).toEqual({
      appName: null,
      version: null,
    });
  });
});
