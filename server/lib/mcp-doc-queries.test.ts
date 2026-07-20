import { describe, it, expect } from "vitest";
import { buildListDocsHint } from "./mcp-doc-queries";

describe("buildListDocsHint", () => {
  it("warns when app id is unknown", () => {
    const hint = buildListDocsHint({
      app: { id: "missing", name: null, found: false },
      total: 0,
      count: 0,
    });

    expect(hint).toContain("App ID was not found");
  });

  it("explains filter mismatch when docs exist", () => {
    const hint = buildListDocsHint({
      app: { id: "app-1", name: "Order Planning", found: true },
      total: 121,
      count: 0,
      status: "published",
      docCounts: {
        total: 121,
        draft: 121,
        in_review: 0,
        published: 0,
        archived: 0,
        product: 1,
        knowledge: 120,
      },
    });

    expect(hint).toContain("draft=121");
    expect(hint).toContain("list_app_documentation");
  });
});
