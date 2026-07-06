import { describe, expect, it } from "vitest";
import { computeUnifiedLines } from "./diff-lines";

describe("diff-lines", () => {
  it("marks added and removed lines", () => {
    const lines = computeUnifiedLines("alpha\nbeta", "alpha\ngamma");
    expect(lines.some((line) => line.kind === "removed" && line.text === "beta")).toBe(true);
    expect(lines.some((line) => line.kind === "added" && line.text === "gamma")).toBe(true);
    expect(lines.some((line) => line.kind === "unchanged" && line.text === "alpha")).toBe(true);
  });
});
