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

  it("respects weekly and monthly intervals", () => {
    const now = Date.parse("2026-08-12T12:00:00.000Z");
    const recentWeekly = new Date(now - SYNC_INTERVAL_MS.weekly + 1000).toISOString();
    const oldWeekly = new Date(now - SYNC_INTERVAL_MS.weekly - 1000).toISOString();
    const recentMonthly = new Date(now - SYNC_INTERVAL_MS.monthly + 1000).toISOString();
    const oldMonthly = new Date(now - SYNC_INTERVAL_MS.monthly - 1000).toISOString();

    expect(isSyncIntervalDue(recentWeekly, "weekly", now)).toBe(false);
    expect(isSyncIntervalDue(oldWeekly, "weekly", now)).toBe(true);
    expect(isSyncIntervalDue(recentMonthly, "monthly", now)).toBe(false);
    expect(isSyncIntervalDue(oldMonthly, "monthly", now)).toBe(true);
  });
});
