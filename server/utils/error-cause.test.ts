import { describe, expect, it } from "vitest";
import { errorCauseMessage } from "./error-cause";

describe("errorCauseMessage", () => {
  it("returns cause message when present", () => {
    const err = new Error("Failed query: select 1");
  (err as Error & { cause: Error }).cause = new Error("timeout exceeded when trying to connect");
    expect(errorCauseMessage(err)).toBe("timeout exceeded when trying to connect");
  });

  it("returns undefined when there is no cause", () => {
    expect(errorCauseMessage(new Error("plain"))).toBeUndefined();
    expect(errorCauseMessage("x")).toBeUndefined();
  });
});