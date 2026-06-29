import { describe, expect, it } from "vitest";
import { normalizeNotionId } from "~/server/lib/notion/client";

describe("normalizeNotionId", () => {
  it("formats 32-char IDs into UUID form", () => {
    expect(normalizeNotionId("38bccba5c5ad8054a6f2ef8ac2ab704f")).toBe(
      "38bccba5-c5ad-8054-a6f2-ef8ac2ab704f"
    );
  });

  it("leaves dashed IDs unchanged", () => {
    const id = "38bccba5-c5ad-8054-a6f2-ef8ac2ab704f";
    expect(normalizeNotionId(id)).toBe(id);
  });
});
