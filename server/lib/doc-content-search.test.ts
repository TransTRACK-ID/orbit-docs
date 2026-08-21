import { describe, expect, it } from "vitest";
import { indexableDocTypesForCategory } from "./doc-chunking";

describe("indexableDocTypesForCategory", () => {
  it("maps product and knowledge categories", () => {
    expect(indexableDocTypesForCategory("knowledge")).toEqual(["feature"]);
    expect(indexableDocTypesForCategory("product")).toEqual(["sdd", "wiki"]);
    expect(indexableDocTypesForCategory()).toEqual(["feature", "sdd", "wiki"]);
  });
});
