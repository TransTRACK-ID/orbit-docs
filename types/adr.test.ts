import { describe, expect, it } from "vitest";
import {
  formatAdrNumber,
  parseAdrFrontmatter,
  validateAdrFrontmatter,
} from "~/types/adr";

describe("validateAdrFrontmatter", () => {
  it("accepts empty frontmatter", () => {
    expect(validateAdrFrontmatter(null)).toEqual([]);
    expect(validateAdrFrontmatter({})).toEqual([]);
  });

  it("accepts valid ADR frontmatter", () => {
    expect(
      validateAdrFrontmatter({
        adr_status: "accepted",
        adr_number: 7,
        supersedes: "550e8400-e29b-41d4-a716-446655440000",
        scope: ["backend", "api"],
        date: "2026-08-07",
        deciders: ["alice@example.com"],
      })
    ).toEqual([]);
  });

  it("rejects invalid adr_status", () => {
    const errors = validateAdrFrontmatter({ adr_status: "pending" });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.field).toBe("adr_status");
  });

  it("rejects invalid adr_number", () => {
    expect(validateAdrFrontmatter({ adr_number: 0 })).toHaveLength(1);
    expect(validateAdrFrontmatter({ adr_number: 1.5 })).toHaveLength(1);
  });

  it("rejects invalid supersedes UUID", () => {
    const errors = validateAdrFrontmatter({ supersedes: "not-a-uuid" });
    expect(errors[0]?.field).toBe("supersedes");
  });

  it("rejects empty scope tags", () => {
    const errors = validateAdrFrontmatter({ scope: ["backend", ""] });
    expect(errors[0]?.field).toBe("scope[1]");
  });
});

describe("parseAdrFrontmatter", () => {
  it("parses known fields and ignores invalid types", () => {
    expect(
      parseAdrFrontmatter({
        adr_status: "proposed",
        adr_number: 3,
        scope: ["api", 42],
        deciders: ["bob", null],
      })
    ).toEqual({
      adr_status: "proposed",
      adr_number: 3,
      scope: ["api"],
      deciders: ["bob"],
    });
  });
});

describe("formatAdrNumber", () => {
  it("pads ADR numbers to three digits", () => {
    expect(formatAdrNumber(7)).toBe("ADR-007");
    expect(formatAdrNumber(null)).toBe("ADR");
  });
});
