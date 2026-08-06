import { describe, expect, it } from "vitest";
import { buildMarkdownOutline } from "./useMarkdownOutline";

describe("buildMarkdownOutline", () => {
  it("uses unique keys for duplicate heading labels", () => {
    const headings = [
      { level: 1, text: "Hybrid Communication" },
      { level: 2, text: "Feature Overview" },
      { level: 1, text: "Red Flag Management" },
      { level: 2, text: "Feature Overview" },
    ];
    const items = buildMarkdownOutline(headings);

    const featureOverview = items.filter((item) => item.label === "Feature Overview");
    expect(featureOverview).toHaveLength(2);
    expect(featureOverview[0].key).toBe("h:feature-overview");
    expect(featureOverview[1].key).toBe("h:feature-overview-2");
    expect(featureOverview[0].targetId).toBe("feature-overview");
    expect(featureOverview[1].targetId).toBe("feature-overview-2");
  });
});
