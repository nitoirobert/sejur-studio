// The public site's unit shape. The data comes from the database (src/lib/catalog/server.ts);
// this file keeps its old name so Robert's components import the same types.
// Prices are in BANI (1 leu = 100 bani), as in the database.

export type UnitType = "camera" | "apartament" | "garsoniera" | "casuta";

export type Amenity =
  | "wifi"
  | "parking"
  | "breakfast"
  | "kitchen"
  | "fireplace"
  | "pets"
  | "ac"
  | "view"
  | "sea"
  | "pool";

export const AMENITIES: readonly Amenity[] = [
  "wifi",
  "parking",
  "breakfast",
  "kitchen",
  "fireplace",
  "pets",
  "ac",
  "view",
  "sea",
  "pool",
];

export type Unit = {
  id: string; // uuid
  name: string;
  type: UnitType;
  location: string; // "Bran, Brașov" (property city), "" when unknown
  propertyName: string;
  checkIn: string; // "15:00"
  checkOut: string; // "11:00"
  pricePerNight: number; // base price, bani
  rating: number | null; // no reviews yet: null, the star is hidden
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  area: number | null; // m²
  amenities: Amenity[];
  description: string;
  photos: string[]; // never empty: a placeholder when the unit has no photo
  hasPhotos: boolean;
  highlights: Amenity[]; // at most 2 key amenities, shown as icons on the card
  lat: number | null; // property coordinates; null = not on the map
  lng: number | null;
  offer?: { percent: number; label: "winter" | "lastMinute" };
};

// A unit that can be drawn on the map.
export type MappedUnit = Unit & { lat: number; lng: number };
export const onMap = (u: Unit): u is MappedUnit => u.lat !== null && u.lng !== null;

// Nightly price after the offer, rounded to a whole leu (bani)
export function nightly(unit: Unit) {
  if (!unit.offer) return unit.pricePerNight;
  return Math.round((unit.pricePerNight * (100 - unit.offer.percent)) / 100 / 100) * 100;
}

// Shown when a unit has no photo yet: a soft cream tile with a house outline.
export const PLACEHOLDER_PHOTO =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#efe8dc"/><path d="M160 170v-34l40-30 40 30v34h-26v-24h-28v24z" fill="none" stroke="#b9ad98" stroke-width="6" stroke-linejoin="round"/></svg>`,
  );

// Small preview for the map card: Unsplash takes size parameters, signed Storage URLs do not
// (adding "?w=" would break the token).
export function photoThumb(src: string, width: number) {
  return src.startsWith("https://images.unsplash.com/") ? `${src}?w=${width}&q=70&auto=format&fit=crop` : src;
}

// Default stay in the search bar (fixed, so the page does not depend on the current date)
export const defaultStay = {
  from: "2026-11-13",
  to: "2026-11-16",
  nights: 3,
  guests: 2,
};
