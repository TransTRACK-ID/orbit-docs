import { describe, it, expect } from "vitest";
import { buildClientRedirectUrl, describeScope } from "./consent";

describe("describeScope", () => {
  it("describes the default scope in plain language", () => {
    const descriptions = describeScope("mcp:read");
    expect(descriptions).toHaveLength(1);
    expect(descriptions[0]).not.toBe("mcp:read");
  });

  it("falls back to the raw scope for unknown values", () => {
    expect(describeScope("custom:scope")).toEqual(["custom:scope"]);
  });
});

describe("buildClientRedirectUrl", () => {
  it("appends code, state, and issuer params without dropping existing ones", () => {
    const url = buildClientRedirectUrl("https://client.example.com/cb?foo=bar", {
      code: "abc",
      state: "xyz",
      iss: "https://orbit.example.com",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("foo")).toBe("bar");
    expect(parsed.searchParams.get("code")).toBe("abc");
    expect(parsed.searchParams.get("state")).toBe("xyz");
    expect(parsed.searchParams.get("iss")).toBe("https://orbit.example.com");
  });
});
