import { describe, expect, it } from "vitest";
import { reciprocalRankFusion } from "./doc-chunk-search";

describe("reciprocalRankFusion", () => {
  it("boosts items ranked highly in both lists", () => {
    const scores = reciprocalRankFusion(
      [
        [{ id: "a" }, { id: "b" }, { id: "c" }],
        [{ id: "b" }, { id: "a" }, { id: "d" }],
      ],
      60,
    );

    expect(scores.get("b")!).toBeGreaterThan(scores.get("c")!);
    expect(scores.get("b")!).toBeGreaterThan(scores.get("d")!);
    expect(scores.has("a")).toBe(true);
    expect(scores.has("d")).toBe(true);
  });
});
