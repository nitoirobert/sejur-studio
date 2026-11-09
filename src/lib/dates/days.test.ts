import { describe, expect, it } from "vitest";
import { addDays, dayRange, diffDays, isIsoDate, isWeekend } from "./days";

describe("days", () => {
  it("validates real calendar dates only", () => {
    expect(isIsoDate("2026-11-08")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-1-01")).toBe(false);
    expect(isIsoDate("1999-12-31")).toBe(false);
    expect(isIsoDate("x")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });

  it("gives 7 distinct days across the spring DST change (29 March 2026)", () => {
    const days = dayRange("2026-03-26", 7);
    expect(days).toEqual([
      "2026-03-26", "2026-03-27", "2026-03-28", "2026-03-29", "2026-03-30", "2026-03-31", "2026-04-01",
    ]);
    expect(new Set(days).size).toBe(7);
  });

  it("gives 7 distinct days across the autumn DST change (25 October 2026)", () => {
    const days = dayRange("2026-10-22", 7);
    expect(days).toEqual([
      "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28",
    ]);
    expect(diffDays("2026-10-24", "2026-10-26")).toBe(2);
    expect(diffDays("2026-03-28", "2026-03-30")).toBe(2);
  });

  it("adds days across months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-11-10", 3)).toBe("2026-11-13");
  });

  it("does not depend on the process time zone", () => {
    // The functions only use Date.UTC / getUTC*; TZ is irrelevant. Spot-check the weekend logic.
    expect(isWeekend("2026-11-07")).toBe(true); // Saturday
    expect(isWeekend("2026-11-08")).toBe(true); // Sunday
    expect(isWeekend("2026-11-09")).toBe(false);
  });
});
