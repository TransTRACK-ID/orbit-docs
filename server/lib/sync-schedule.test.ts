import { describe, expect, it } from "vitest";
import { isSyncIntervalDue, SYNC_INTERVAL_MS } from "./sync-schedule";

describe("sync-schedule", () => {
  it("treats missing last run as due", () => {
    expect(isSyncIntervalDue(null, "daily")).toBe(true);
    expect(isSyncIntervalDue(undefined, "hourly")).toBe(true);
  });

  it("respects hourly and daily intervals", () => {
    const now = Date.parse("2026-08-12T12:00:00.000Z");
    const recent = new Date(now - SYNC_INTERVAL_MS.hourly + 1000).toISOString();
    const oldHourly = new Date(now - SYNC_INTERVAL_MS.hourly - 1000).toISOString();
    const oldDaily = new Date(now - SYNC_INTERVAL_MS.daily - 1000).toISOString();

    expect(isSyncIntervalDue(recent, "hourly", now)).toBe(false);
    expect(isSyncIntervalDue(oldHourly, "hourly", now)).toBe(true);
    expect(isSyncIntervalDue(oldDaily, "daily", now)).toBe(true);
  });
});
