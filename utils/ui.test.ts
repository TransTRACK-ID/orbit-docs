import { describe, expect, it } from "vitest";
import { isEmpty, isSameString, constrain, timeAgo, plainTextPreview } from "./ui";

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

describe("timeAgo function", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();

  it("should return an empty string without a date", () => {
    expect(timeAgo(null, now)).toBe("");
  });

  it("should use singular and plural units", () => {
    expect(timeAgo(ago(30), now)).toBe("just now");
    expect(timeAgo(ago(5 * 60), now)).toBe("5 min ago");
    expect(timeAgo(ago(3600), now)).toBe("1 hour ago");
    expect(timeAgo(ago(3 * 86400), now)).toBe("3 days ago");
    expect(timeAgo(ago(14 * 86400), now)).toBe("2 weeks ago");
    expect(timeAgo(ago(100 * 86400), now)).toBe("3 months ago");
  });
});

describe("plainTextPreview function", () => {
  it("should strip markdown and html syntax", () => {
    expect(plainTextPreview("## Overview\n**Base URL**: `https://api.x.id`\n- [Auth](/auth) <br/> user_id"))
      .toBe("Overview Base URL : https://api.x.id Auth user_id");
  });

  it("should drop table separators and code blocks", () => {
    expect(plainTextPreview("| A | B |\n|---|---|\n| 1 | 2 |\n```js\nx()\n```")).toBe("A B 1 2");
  });
});

describe("plainTextPreview escapes", () => {
  it("should unescape markdown escapes", () => {
    expect(plainTextPreview("Change Log 1\\. New \\*item\\*")).toBe("Change Log 1. New item");
  });
});
