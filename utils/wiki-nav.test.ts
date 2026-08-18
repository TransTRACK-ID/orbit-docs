import { describe, expect, it } from "vitest";
import { buildNavConfigFromPlan } from "./wiki-nav";

describe("buildNavConfigFromPlan", () => {
  it("keeps Overview only in its group, not also under Pages", () => {
    const nav = buildNavConfigFromPlan({
      pages: [
        { slug: "1-overview", group: "Core" },
        { slug: "2-api", group: "Core" },
        { slug: "3-frontend", group: "Components" },
      ],
    });

    expect(nav.pages).toEqual([]);
    expect(nav.groups).toEqual([
      { id: "core", label: "Core", pages: ["1-overview", "2-api"] },
      { id: "components", label: "Components", pages: ["3-frontend"] },
    ]);
  });

  it("puts ungrouped pages in the top-level pages list", () => {
    const nav = buildNavConfigFromPlan({
      pages: [
        { slug: "1-overview", group: "Core" },
        { slug: "9-notes" },
      ],
    });

    expect(nav.pages).toEqual(["9-notes"]);
    expect(nav.groups?.[0]?.pages).toEqual(["1-overview"]);
  });

  it("drops duplicate slugs, keeping the first occurrence", () => {
    const nav = buildNavConfigFromPlan({
      pages: [
        { slug: "1-overview", group: "Core" },
        { slug: "1-overview", group: "Pages" },
      ],
    });

    expect(nav.groups).toHaveLength(1);
    expect(nav.groups?.[0]?.pages).toEqual(["1-overview"]);
    expect(nav.pages).toEqual([]);
  });
});
