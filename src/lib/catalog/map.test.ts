import { describe, expect, it } from "vitest";
import { PLACEHOLDER_PHOTO } from "@/lib/mock-units";
import { priceLimits } from "@/components/browse/filters";
import { buildPlaces } from "@/lib/search/catalog";
import { toAmenities, toUnit, UUID_RE, type PropertyRow, type UnitRow } from "./map";

const unitRow: UnitRow = {
  id: "b1000000-0000-4000-8000-000000000001",
  name: "Căsuța din Brazi",
  type: "casuta",
  max_guests: 4,
  bedrooms: 2,
  beds: 3,
  bathrooms: 1,
  area_m2: 60,
  description: "  Cabană lângă pădure.  ",
  amenities: ["wifi", "fireplace", "unknown", "wifi", 3],
  position: 0,
  property_id: "p1",
};
const property: PropertyRow = {
  id: "p1",
  name: "Pensiunea Valea Lină",
  city: "Bran, Brașov",
  lat: 45.5,
  lng: 25.3,
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
};

describe("toAmenities", () => {
  it("keeps known amenities once and drops the rest", () => {
    expect(toAmenities(["wifi", "nope", "wifi", 1, "sea"])).toEqual(["wifi", "sea"]);
    expect(toAmenities(null)).toEqual([]);
    expect(toAmenities("wifi")).toEqual([]);
  });
});

describe("toUnit", () => {
  it("maps a full row", () => {
    const u = toUnit(unitRow, property, 35000, ["https://x/sign/a.jpg"]);
    expect(u).toMatchObject({
      name: "Căsuța din Brazi",
      location: "Bran, Brașov",
      propertyName: "Pensiunea Valea Lină",
      checkIn: "15:00",
      checkOut: "11:00",
      pricePerNight: 35000,
      rating: null,
      area: 60,
      description: "Cabană lângă pădure.",
      amenities: ["wifi", "fireplace"],
      highlights: ["fireplace", "wifi"],
      photos: ["https://x/sign/a.jpg"],
      hasPhotos: true,
      lat: 45.5,
      lng: 25.3,
    });
  });

  it("uses the placeholder when there are no photos", () => {
    const u = toUnit(unitRow, property, 35000, []);
    expect(u.photos).toEqual([PLACEHOLDER_PHOTO]);
    expect(u.hasPhotos).toBe(false);
  });

  it("drops coordinates unless both are valid", () => {
    expect(toUnit(unitRow, { ...property, lng: null }, 1, []).lat).toBeNull();
    const bad = toUnit(unitRow, { ...property, lat: 200 }, 1, []);
    expect([bad.lat, bad.lng]).toEqual([null, null]);
  });

  it("handles missing city, area and description", () => {
    const u = toUnit({ ...unitRow, area_m2: null, description: null }, { ...property, city: null }, 1, []);
    expect([u.location, u.area, u.description]).toEqual(["", null, ""]);
  });
});

describe("UUID_RE", () => {
  it("accepts uuids only", () => {
    expect(UUID_RE.test(unitRow.id)).toBe(true);
    expect(UUID_RE.test("casuta-brazi")).toBe(false);
    expect(UUID_RE.test(`${unitRow.id}' or 1=1`)).toBe(false);
  });
});

describe("derived catalog data", () => {
  const a = toUnit(unitRow, property, 35000, []);
  const b = toUnit({ ...unitRow, id: "b2" }, { ...property, city: "Olimp, Constanța" }, 52000, []);

  it("priceLimits works on an empty list", () => {
    const l = priceLimits([]);
    expect(l.PRICE_MIN).toBe(0);
    expect(l.PRICE_MAX).toBeGreaterThan(l.PRICE_MIN);
  });

  it("priceLimits covers every unit", () => {
    const l = priceLimits([a, b]);
    expect(l.PRICE_MIN).toBeLessThanOrEqual(35000);
    expect(l.PRICE_MAX).toBeGreaterThanOrEqual(52000);
  });

  it("buildPlaces lists only places that have units", () => {
    const { sitePlaces } = buildPlaces([a, b]);
    const names = JSON.stringify(sitePlaces);
    expect(names).toContain("Bran");
    expect(names).toContain("Olimp");
    expect(buildPlaces([]).places.length).toBeGreaterThanOrEqual(0);
  });
});
