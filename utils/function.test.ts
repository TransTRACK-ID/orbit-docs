import { describe, expect, it } from "vitest";
import { roundToDecimal, formatDate, changesToFiltersOptions, capitalizeString } from "./functions";

describe("roundToDecimal Function", () => {
  it("should render '-' when value is false", () => {
    expect(roundToDecimal(null)).toBe("-");
    expect(roundToDecimal(undefined)).toBe("-");
    expect(roundToDecimal(0)).toBe("-");
    expect(roundToDecimal(false)).toBe("-");
    expect(roundToDecimal("")).toBe("-");
  });

  it("should round numbers to decimal", () => {
    expect(roundToDecimal(1.25)).toBe("1.3");
    expect(roundToDecimal(1.24)).toBe("1.2");
    expect(roundToDecimal(7)).toBe("7.0");
    expect(roundToDecimal(10.99)).toBe("11.0");
  });
});

describe("formatDate Function", () => {
  it("should format ISO dates correctly", () => {
    expect(formatDate("2024-01-15T10:30:00Z")).toBe("2024-01-15 10:30:00");
  });

  it("should support custom output formats", () => {
    expect(formatDate("2024-01-15T10:30:00Z", "yyyy-MM-dd")).toBe("2024-01-15");
  });
});

describe("changesToFiltersOptions Function", () => {
  it("should convert list to filter options", () => {
    const result = changesToFiltersOptions(["a", "b", "c"]);
    expect(result).toEqual([
      { text: "a", value: "a" },
      { text: "b", value: "b" },
      { text: "c", value: "c" },
    ]);
  });

  it("should return empty array for empty input", () => {
    expect(changesToFiltersOptions(null)).toEqual([]);
    expect(changesToFiltersOptions([])).toEqual([]);
  });
});

describe("capitalizeString Function", () => {
  it("should capitalize first letter without separator", () => {
    expect(capitalizeString("hello")).toBe("Hello");
    expect(capitalizeString("HELLO")).toBe("Hello");
  });

  it("should capitalize with separator", () => {
    expect(capitalizeString("hello_world", "_")).toBe("Hello World");
    expect(capitalizeString("foo-bar", "-")).toBe("Foo Bar");
  });

  it("should handle empty strings", () => {
    expect(capitalizeString("")).toBeUndefined();
  });
});
