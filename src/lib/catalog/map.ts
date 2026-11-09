import { AMENITIES, PLACEHOLDER_PHOTO, type Amenity, type Unit, type UnitType } from "@/lib/mock-units";

// Pure mapping from database rows to the public Unit shape (unit-tested in map.test.ts).

export type UnitRow = {
  id: string;
  name: string;
  type: UnitType;
  max_guests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  area_m2: number | null;
  description: string | null;
  amenities: unknown;
  position: number;
  property_id: string;
};

export type PropertyRow = {
  id: string;
  name: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  check_in_time: string;
  check_out_time: string;
};

// Which amenities make the two card icons, most distinctive first
const HIGHLIGHT_ORDER: Amenity[] = ["fireplace", "sea", "pool", "view", "breakfast", "kitchen", "pets", "ac", "parking", "wifi"];

export function toAmenities(value: unknown): Amenity[] {
  if (!Array.isArray(value)) return [];
  const known = new Set<string>(AMENITIES);
  return [...new Set(value.filter((a): a is Amenity => typeof a === "string" && known.has(a)))];
}

const hhmm = (t: string) => t.slice(0, 5);
const coord = (n: number | null, min: number, max: number) =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max ? n : null;

export function toUnit(u: UnitRow, p: PropertyRow, basePrice: number, photos: string[]): Unit {
  const amenities = toAmenities(u.amenities);
  const lat = coord(p.lat, -90, 90);
  const lng = coord(p.lng, -180, 180);
  const both = lat !== null && lng !== null;
  return {
    id: u.id,
    name: u.name,
    type: u.type,
    location: p.city?.trim() ?? "",
    propertyName: p.name,
    checkIn: hhmm(p.check_in_time),
    checkOut: hhmm(p.check_out_time),
    pricePerNight: basePrice,
    rating: null,
    maxGuests: u.max_guests,
    bedrooms: u.bedrooms,
    beds: u.beds,
    bathrooms: u.bathrooms,
    area: u.area_m2,
    amenities,
    description: u.description?.trim() ?? "",
    photos: photos.length > 0 ? photos : [PLACEHOLDER_PHOTO],
    hasPhotos: photos.length > 0,
    highlights: HIGHLIGHT_ORDER.filter((a) => amenities.includes(a)).slice(0, 2),
    lat: both ? lat : null,
    lng: both ? lng : null,
  };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
