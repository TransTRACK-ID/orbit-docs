import { describe, expect, it } from "vitest";
import { isEmpty, isSameString } from "./ui";

describe("isSameString function", () => {
  it("should return true when key exists in value", () => {
    expect(isSameString("Indonesia", "indo")).toBe(true);
    expect(isSameString("HELLO", "hello")).toBe(true);
  });

  it("should return false when key does not exist in value", () => {
    expect(isSameString("Hello", "world")).toBe(false);
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
  });
});
