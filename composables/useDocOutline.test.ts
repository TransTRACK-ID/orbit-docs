import { describe, expect, it } from "vitest";
import { pickActiveHeadingId } from "./useDocOutline";

describe("pickActiveHeadingId", () => {
  const headings = [
    { id: "intro", top: 120 },
    { id: "setup", top: 420 },
    { id: "usage", top: 780 },
  ];

  it("selects the first heading when probe is above all sections", () => {
    expect(pickActiveHeadingId(headings, 100)).toBe("intro");
  });

  it("selects the last heading at or above the probe", () => {
    expect(pickActiveHeadingId(headings, 420)).toBe("setup");
    expect(pickActiveHeadingId(headings, 500)).toBe("setup");
    expect(pickActiveHeadingId(headings, 900)).toBe("usage");
  });

  it("returns empty string when there are no headings", () => {
    expect(pickActiveHeadingId([], 200)).toBe("");
  });
});
