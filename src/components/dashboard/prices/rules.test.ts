import { describe, expect, it } from "vitest";
import { unitSchema } from "@/components/dashboard/property/schema";
import {
  dateToToLastNight,
  isWeekendNight,
  lastNightToDateTo,
  previewNights,
  priceForNight,
  sameRankOverlap,
  seasonSchema,
  type PriceRule,
} from "./rules";

const rule = (r: Partial<PriceRule> & Pick<PriceRule, "id" | "kind" | "price">): PriceRule => ({
  dateFrom: null,
  dateTo: null,
  minNights: 1,
  priority: 0,
  createdAt: "2026-11-01T00:00:00Z",
  ...r,
});

const base = rule({ id: "b", kind: "base", price: 30000 });
const weekend = rule({ id: "w", kind: "weekend", price: 40000 });
const august = rule({ id: "s", kind: "season", price: 60000, dateFrom: "2027-08-01", dateTo: "2027-09-01" });

describe("season dates", () => {
  it("1-31 Aug is stored with date_to = 1 Sep and shown back as 31 Aug", () => {
    expect(lastNightToDateTo("2027-08-31")).toBe("2027-09-01");
    expect(dateToToLastNight("2027-09-01")).toBe("2027-08-31");
  });

  it("crosses month and year ends", () => {
    expect(lastNightToDateTo("2027-12-31")).toBe("2028-01-01");
    expect(lastNightToDateTo("2028-02-28")).toBe("2028-02-29");
  });

  const season = { id: null, unit_id: "3f1c8d2e-1a2b-4c3d-8e9f-0a1b2c3d4e5f", price: "600", min_nights: "2", priority: "1" };

  it("parses a valid season to [date_from, date_to)", () => {
    const r = seasonSchema.safeParse({ ...season, first_night: "2027-08-01", last_night: "2027-08-31" });
    expect(r.success && r.data).toMatchObject({ date_from: "2027-08-01", date_to: "2027-09-01", price: 60000 });
  });

  it("accepts a one-night season (first = last night)", () => {
    const r = seasonSchema.safeParse({ ...season, first_night: "2027-08-01", last_night: "2027-08-01" });
    expect(r.success && r.data.date_to).toBe("2027-08-02");
  });

  it("refuses date_to <= date_from (last night before the first)", () => {
    const r = seasonSchema.safeParse({ ...season, first_night: "2027-08-10", last_night: "2027-08-09" });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].path[0]).toBe("last_night");
  });

  it("refuses an impossible date and an extra key", () => {
    expect(seasonSchema.safeParse({ ...season, first_night: "2027-02-30", last_night: "2027-03-02" }).success).toBe(false);
    expect(
      seasonSchema.safeParse({ ...season, first_night: "2027-08-01", last_night: "2027-08-02", organization_id: season.unit_id })
        .success,
    ).toBe(false);
  });
});

describe("price for a night: season > weekend > base", () => {
  it("knows Friday and Saturday nights", () => {
    expect(isWeekendNight("2027-07-30")).toBe(true); // Friday
    expect(isWeekendNight("2027-07-31")).toBe(true); // Saturday
    expect(isWeekendNight("2027-08-01")).toBe(false); // Sunday
    expect(isWeekendNight("2027-07-29")).toBe(false); // Thursday
  });

  it("uses the base price on a weekday, the weekend price on Friday", () => {
    expect(priceForNight([base, weekend], "2027-07-29")).toMatchObject({ price: 30000, kind: "base" });
    expect(priceForNight([base, weekend], "2027-07-30")).toMatchObject({ price: 40000, kind: "weekend" });
    expect(priceForNight([base, weekend], "2027-08-01")).toMatchObject({ price: 30000, kind: "base" });
  });

  it("a season beats the weekend; the night of date_to is back to normal", () => {
    expect(priceForNight([base, weekend, august], "2027-08-06")).toMatchObject({ price: 60000, kind: "season" }); // Friday
    expect(priceForNight([base, weekend, august], "2027-08-31")).toMatchObject({ price: 60000 });
    expect(priceForNight([base, weekend, august], "2027-09-01")).toMatchObject({ price: 30000, kind: "base" });
  });

  it("the highest priority wins; equal priority goes to the newest", () => {
    const high = rule({ ...august, id: "h", price: 90000, priority: 5, dateFrom: "2027-08-10", dateTo: "2027-08-12" });
    expect(priceForNight([base, august, high], "2027-08-10").ruleId).toBe("h");
    const newer = rule({ ...august, id: "n", price: 70000, createdAt: "2026-11-05T00:00:00Z" });
    expect(priceForNight([base, august, newer], "2027-08-15").ruleId).toBe("n");
  });

  it("no base price: no price", () => {
    expect(priceForNight([weekend], "2027-07-29")).toMatchObject({ price: null, kind: null });
  });

  it("previews 30 nights from the first one", () => {
    const nights = previewNights([base, weekend], "2027-07-29");
    expect(nights).toHaveLength(30);
    expect(nights[0].night).toBe("2027-07-29");
    expect(nights[29].night).toBe("2027-08-27");
    expect(nights.filter((n) => n.kind === "weekend")).toHaveLength(9); // 5 Fridays (30 Jul - 27 Aug) + 4 Saturdays
  });
});

describe("same-priority overlap", () => {
  const seasons = [{ id: "a", dateFrom: "2027-08-01", dateTo: "2027-09-01", priority: 0 }];
  it("refuses a shared night at the same priority", () => {
    expect(sameRankOverlap(seasons, { id: null, dateFrom: "2027-08-31", dateTo: "2027-09-05", priority: 0 })).toBe(true);
  });
  it("allows touching ranges, another priority, and editing itself", () => {
    expect(sameRankOverlap(seasons, { id: null, dateFrom: "2027-09-01", dateTo: "2027-09-05", priority: 0 })).toBe(false);
    expect(sameRankOverlap(seasons, { id: null, dateFrom: "2027-08-10", dateTo: "2027-08-12", priority: 1 })).toBe(false);
    expect(sameRankOverlap(seasons, { id: "a", dateFrom: "2027-08-02", dateTo: "2027-08-20", priority: 0 })).toBe(false);
  });
});

describe("unit price in lei", () => {
  const unit = {
    id: null,
    property_id: "3f1c8d2e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
    name: "Camera 1",
    type: "camera",
    max_guests: "2",
    bedrooms: "1",
    beds: "1",
    bathrooms: "1",
    area_m2: "",
    description: "",
    amenities: [],
    is_published: false,
  } as const;
  const price = (base_price: string) => unitSchema.safeParse({ ...unit, base_price });

  it("„450,50” is 45050 bani", () => {
    const r = price("450,50");
    expect(r.success && r.data.base_price).toBe(45050);
  });

  it("refuses negative, letters, zero, empty and above 21.000.000 lei", () => {
    for (const v of ["-5", "abc", "0", "", "21.000.000,01", "99999999"]) expect(price(v).success, v).toBe(false);
    const max = price("21.000.000");
    expect(max.success && max.data.base_price).toBe(2_100_000_000);
  });

  it("refuses capacity 0, an unknown type, an unknown amenity and an extra key", () => {
    expect(unitSchema.safeParse({ ...unit, base_price: "100", max_guests: "0" }).success).toBe(false);
    expect(unitSchema.safeParse({ ...unit, base_price: "100", type: "cabana" }).success).toBe(false);
    expect(unitSchema.safeParse({ ...unit, base_price: "100", amenities: ["jacuzzi"] }).success).toBe(false);
    expect(unitSchema.safeParse({ ...unit, base_price: "100", organization_id: unit.property_id }).success).toBe(false);
  });
});
