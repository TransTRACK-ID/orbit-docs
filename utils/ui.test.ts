import { describe, expect, it } from "vitest";
import { isEmpty, isSameString, constrain } from "./ui";

describe("isSameString function", () => {
  it("should return true when key exists in value", () => {
    expect(isSameString("Indonesia", "indo")).toBe(true);
    expect(isSameString("HELLO", "hello")).toBe(true);
  });

  it("should return false when key does not exist in value", () => {
    expect(isSameString("Hello", "world")).toBe(false);
  });

  it("should be case-insensitive", () => {
    expect(isSameString("TeSt", "test")).toBe(true);
    expect(isSameString("UPPER", "upper")).toBe(true);
  });
});

describe("isEmpty function", () => {
  it('should return true for null, undefined, "", or empty array', () => {
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty(undefined)).toBe(true);
    expect(isEmpty("")).toBe(true);
    expect(isEmpty([])).toBe(true);
  });

  it("should return false for values not none", () => {
    expect(isEmpty("hello")).toBe(false);
    expect(isEmpty([1, 2, 3])).toBe(false);
    expect(isEmpty(0)).toBe(true);
    expect(isEmpty(false)).toBe(true);
  });
});

describe("constrain function", () => {
  it("should constrain value within min and max", () => {
    expect(constrain(5, 0, 10)).toBe(5);
    expect(constrain(-5, 0, 10)).toBe(0);
    expect(constrain(15, 0, 10)).toBe(10);
  });

  it("should handle edge cases", () => {
    expect(constrain(0, 0, 10)).toBe(0);
    expect(constrain(10, 0, 10)).toBe(10);
  });
});
