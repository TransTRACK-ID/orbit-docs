import { describe, expect, it } from "vitest";
import { buildNavConfigFromPlan } from "./wiki-nav";

describe("buildNavConfigFromPlan", () => {
  it("keeps Overview only in its group, not also under Pages", () => {
    const nav = buildNavConfigFromPlan({
      pages: [
        { slug: "1-overview", groupPath: ["Core"] },
        { slug: "2-api", groupPath: ["Core"] },
        { slug: "3-frontend", groupPath: ["Components"] },
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
        { slug: "1-overview", groupPath: ["Core"] },
        { slug: "9-notes" },
      ],
    });

    expect(nav.pages).toEqual(["9-notes"]);
    expect(nav.groups?.[0]?.pages).toEqual(["1-overview"]);
  });

  it("drops duplicate slugs, keeping the first occurrence", () => {
    const nav = buildNavConfigFromPlan({
      pages: [
        { slug: "1-overview", groupPath: ["Core"] },
        { slug: "1-overview", groupPath: ["Pages"] },
      ],
    });

    expect(nav.groups).toHaveLength(1);
    expect(nav.groups?.[0]?.pages).toEqual(["1-overview"]);
    expect(nav.pages).toEqual([]);
  });

  it("builds a 3-level nested tree", () => {
    const nav = buildNavConfigFromPlan({
      pages: [
        { slug: "1-overview", groupPath: ["Core"] },
        { slug: "2-render", groupPath: ["Video Generation", "Carousel", "Rendering"] },
        { slug: "3-upload", groupPath: ["Video Generation", "Carousel", "Upload"] },
        { slug: "4-audio", groupPath: ["Video Generation", "Audio"] },
      ],
    });
    expect(nav.groups).toEqual([
      { id: "core", label: "Core", pages: ["1-overview"] },
      {
        id: "video-generation",
        label: "Video Generation",
        groups: [
          {
            id: "video-generation-carousel",
            label: "Carousel",
            groups: [
              { id: "video-generation-carousel-rendering", label: "Rendering", pages: ["2-render"] },
              { id: "video-generation-carousel-upload", label: "Upload", pages: ["3-upload"] },
            ],
          },
          { id: "video-generation-audio", label: "Audio", pages: ["4-audio"] },
        ],
      },
    ]);
    expect(nav.pages).toEqual([]);
  });

  it("keeps a prefix page in a node alongside its subgroups, in first-appearance order", () => {
    const nav = buildNavConfigFromPlan({
      pages: [
        { slug: "2-deep", groupPath: ["Core", "Auth", "Tokens"] },
        { slug: "1-core", groupPath: ["Core"] },
        { slug: "3-zeta", groupPath: ["Zeta"] },
      ],
    });
    expect(nav.groups?.map((g) => g.label)).toEqual(["Core", "Zeta"]);
    expect(nav.groups?.[0]).toEqual({
      id: "core",
      label: "Core",
      pages: ["1-core"],
      groups: [
        {
          id: "core-auth",
          label: "Auth",
          groups: [{ id: "core-auth-tokens", label: "Tokens", pages: ["2-deep"] }],
        },
      ],
    });
  });
});
