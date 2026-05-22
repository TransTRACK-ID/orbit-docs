import { describe, expect, it } from "vitest";
import { roundToDecimal } from "./functions";

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
