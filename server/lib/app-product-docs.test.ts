import { describe, expect, it } from "vitest";
import { generationDocTypeToAppDocType } from "./app-product-docs";

describe("generationDocTypeToAppDocType", () => {
  it("maps sdd_index to sdd for app library storage", () => {
    expect(generationDocTypeToAppDocType("sdd_index")).toBe("sdd");
  });

  it("passes through other product doc types", () => {
    expect(generationDocTypeToAppDocType("srs")).toBe("srs");
    expect(generationDocTypeToAppDocType("fsd")).toBe("fsd");
    expect(generationDocTypeToAppDocType("git_snapshot")).toBe("git_snapshot");
  });
});
