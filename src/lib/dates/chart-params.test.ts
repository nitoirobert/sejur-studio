import { describe, expect, it } from "vitest";
import { chartHref, chartWindow, parseChartParams } from "./chart-params";

const today = "2026-11-08";
const P = "a1000000-0000-4000-8000-000000000001";

describe("parseChartParams", () => {
  it("defaults when empty", () => {
    expect(parseChartParams({}, today)).toEqual({ from: "2026-11-07", days: 14, property: null });
  });

  it("reads valid values", () => {
    expect(parseChartParams({ de: "2026-03-26", zile: "30", proprietate: P }, today)).toEqual({
      from: "2026-03-26",
      days: 30,
      property: P,
    });
  });

  it("falls back on malformed values", () => {
    expect(
      parseChartParams({ de: "2026-02-30", zile: "15", proprietate: "'; drop table" }, today),
    ).toEqual({ from: "2026-11-07", days: 14, property: null });
    expect(parseChartParams({ de: ["x", "y"], zile: ["abc"] }, today).days).toBe(14);
    expect(parseChartParams({ zile: "7" }, today).days).toBe(7);
  });

  it("builds the URL and the [from, to) window", () => {
    const p = { from: "2026-11-07", days: 7 as const, property: P };
    expect(chartHref(p)).toBe(`/dashboard?de=2026-11-07&zile=7&proprietate=${P}`);
    expect(chartWindow(p)).toEqual({ from: "2026-11-07", to: "2026-11-14" });
  });
});
