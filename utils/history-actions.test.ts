import { describe, expect, it } from "vitest";
import { getHistoryActionLabel, isPublishAction } from "./history-actions";

describe("history-actions", () => {
  it("maps publish-like actions to Published", () => {
    expect(getHistoryActionLabel("publish")).toBe("Published");
    expect(getHistoryActionLabel("quick_release")).toBe("Published");
    expect(getHistoryActionLabel("article_release")).toBe("Published");
    expect(isPublishAction("quick_release")).toBe(true);
  });

  it("maps save and restore actions", () => {
    expect(getHistoryActionLabel("save")).toBe("Saved");
    expect(getHistoryActionLabel("restore")).toBe("Restored");
  });
});
