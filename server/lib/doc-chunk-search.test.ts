import { describe, expect, it } from "vitest";
import { buildOrTsQuery, isLiteralLikeQuery, reciprocalRankFusion } from "./doc-chunk-search";
import { parseVectorTypeDimensions } from "./doc-embeddings";

describe("isLiteralLikeQuery", () => {
  it("treats IDs, identifiers, and very short queries as literal", () => {
    expect(isLiteralLikeQuery("FEAT-123")).toBe(true);
    expect(isLiteralLikeQuery("user_id")).toBe(true);
    expect(isLiteralLikeQuery("/api/v1/orders")).toBe(true);
    expect(isLiteralLikeQuery("db")).toBe(true);
  });

  it("treats natural-language queries as full-text", () => {
    expect(isLiteralLikeQuery("how does login work")).toBe(false);
    expect(isLiteralLikeQuery("authentication")).toBe(false);
  });
});

describe("buildOrTsQuery", () => {
  it("ORs unique lowercase words with prefix match for longer words", () => {
    expect(buildOrTsQuery("How does Login work? login!")).toBe("how | does:* | login:* | work:*");
  });

  it("keeps unicode words and strips tsquery operators", () => {
    expect(buildOrTsQuery("pengiriman & (barang) | café")).toBe("pengiriman:* | barang:* | café:*");
  });

  it("returns null without word characters", () => {
    expect(buildOrTsQuery("!!! ---")).toBeNull();
  });
});

describe("parseVectorTypeDimensions", () => {
  it("reads pgvector dimensions from format_type output", () => {
    expect(parseVectorTypeDimensions("vector(1536)")).toBe(1536);
    expect(parseVectorTypeDimensions("vector(1024)")).toBe(1024);
    expect(parseVectorTypeDimensions("vector")).toBeNull();
    expect(parseVectorTypeDimensions(undefined)).toBeNull();
  });
});

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
