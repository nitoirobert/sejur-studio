import { describe, expect, it } from "vitest";
import type { ChartBooking } from "../chart/types";
import { nightsIn, withPending } from "./optimistic";

const b = (checkIn: string, checkOut: string, status: ChartBooking["status"] = "confirmed"): ChartBooking => ({
  id: "x",
  unitId: "u",
  propertyId: "p",
  checkIn,
  checkOut,
  status,
  source: "direct",
  guestName: "Ana",
  adults: 1,
  children: 0,
  totalAmount: 0,
  currency: "RON",
  holdExpiresAt: null,
});

describe("nightsIn", () => {
  it("clips a stay to the window", () => {
    expect(nightsIn(b("2026-11-05", "2026-11-10"), "2026-11-08", "2026-12-08")).toBe(2);
    expect(nightsIn(b("2026-12-06", "2026-12-12"), "2026-11-08", "2026-12-08")).toBe(2);
    expect(nightsIn(b("2026-11-01", "2026-11-08"), "2026-11-08", "2026-12-08")).toBe(0);
  });
});

describe("withPending", () => {
  const base = { arrivals: 3, departures: 1, occupancy: 31.7 };
  it("adds a pending booking to the KPI like dashboard_kpis would", () => {
    // 6 units x 30 days = 180 unit-nights; 3 nights = 1.666...%
    expect(withPending(base, [b("2026-11-08", "2026-11-11")], "2026-11-08", 6)).toEqual({
      arrivals: 4,
      departures: 1,
      occupancy: 33.4,
    });
  });
  it("counts a departure today and ignores holds", () => {
    expect(withPending(base, [b("2026-11-06", "2026-11-08"), b("2026-11-08", "2026-11-09", "hold")], "2026-11-08", 6)).toEqual({
      arrivals: 3,
      departures: 2,
      occupancy: 31.7,
    });
  });
  it("returns the base unchanged with nothing pending", () => {
    expect(withPending(base, [], "2026-11-08", 6)).toBe(base);
  });
});
