import { describe, expect, it } from "vitest";
import { indexableDocTypesForCategory } from "./doc-chunking";

describe("indexableDocTypesForCategory", () => {
  it("maps product and knowledge categories", () => {
    expect(indexableDocTypesForCategory("knowledge")).toEqual(["feature"]);
    expect(indexableDocTypesForCategory("product")).toEqual([
      "sdd",
      "wiki",
      "srs",
      "fsd",
      "adr",
      "git_snapshot",
    ]);
    expect(indexableDocTypesForCategory()).toEqual([
      "feature",
      "sdd",
      "wiki",
      "srs",
      "fsd",
      "adr",
      "git_snapshot",
    ]);
  });
});
