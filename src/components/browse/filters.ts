import { nightly, type Amenity, type Unit, type UnitType } from "@/lib/mock-units";
import { normalize } from "@/lib/text";

/* ---------- Limitele prețului (în bani), calculate din unitățile existente ---------- */

const STEP = 5000; // rotunjim la 50 lei
export const PRICE_STEP = 1000; // sliderul se mișcă din 10 în 10 lei

// Limitele sliderului și scurtăturile de preț, din unitățile de pe pagină
export function priceLimits(units: Unit[]) {
  const prices = units.map(nightly);
  const PRICE_MIN = prices.length ? Math.floor(Math.min(...prices) / STEP) * STEP : 0;
  const PRICE_MAX = prices.length ? Math.max(Math.ceil(Math.max(...prices) / STEP) * STEP, PRICE_MIN + STEP) : STEP;
  const priceShortcuts = [
    { id: "low", range: [PRICE_MIN, 25000] },
    { id: "mid", range: [25000, 40000] },
    { id: "high", range: [40000, PRICE_MAX] },
  ] as const;
  return { PRICE_MIN, PRICE_MAX, priceShortcuts };
}

/* ---------- Starea filtrelor ---------- */

export type Filters = {
  types: UnitType[]; // gol = toate
  price: [number, number] | null; // null = orice preț
  bedrooms: number; // minim (0 = oricâte)
  bathrooms: number; // minim
  minRating: number; // 0 = oricare
  onlyOffers: boolean;
  amenities: Amenity[]; // trebuie să le aibă pe toate
};

export const emptyFilters: Filters = {
  types: [],
  price: null,
  bedrooms: 0,
  bathrooms: 0,
  minRating: 0,
  onlyOffers: false,
  amenities: [],
};

export const unitTypes: UnitType[] = ["camera", "apartament", "garsoniera", "casuta"];

export const allAmenities: Amenity[] = [
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

export const ratingOptions = [0, 4.5, 4.7, 4.8];
export const roomOptions = [0, 1, 2, 3];

export function applyFilters(units: Unit[], f: Filters) {
  return units.filter((u) => {
    const p = nightly(u);
    return (
      (f.types.length === 0 || f.types.includes(u.type)) &&
      (!f.price || (p >= f.price[0] && p <= f.price[1])) &&
      u.bedrooms >= f.bedrooms &&
      u.bathrooms >= f.bathrooms &&
      (f.minRating === 0 || (u.rating ?? 0) >= f.minRating) &&
      (!f.onlyOffers || !!u.offer) &&
      f.amenities.every((a) => u.amenities.includes(a))
    );
  });
}

// Câte filtre sunt active (pentru insigna de pe butonul „Filtre")
export function countActive(f: Filters) {
  return (
    f.types.length +
    f.amenities.length +
    (f.price ? 1 : 0) +
    (f.bedrooms ? 1 : 0) +
    (f.bathrooms ? 1 : 0) +
    (f.minRating ? 1 : 0) +
    (f.onlyOffers ? 1 : 0)
  );
}

// Histograma prețurilor: câte unități cad în fiecare interval (pentru graficul de deasupra sliderului)
export function priceHistogram(units: Unit[], bins = 12) {
  const { PRICE_MIN, PRICE_MAX } = priceLimits(units);
  const width = (PRICE_MAX - PRICE_MIN) / bins;
  const counts = Array.from({ length: bins }, () => 0);
  for (const p of units.map(nightly)) {
    counts[Math.max(0, Math.min(bins - 1, Math.floor((p - PRICE_MIN) / width)))]++;
  }
  return counts.map((count, i) => ({
    count,
    from: PRICE_MIN + i * width,
    to: PRICE_MIN + (i + 1) * width,
  }));
}

export function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function matchesQuery(unit: Unit, query: string) {
  const q = normalize(query.trim());
  if (!q) return true;
  return normalize(`${unit.name} ${unit.location}`).includes(q);
}

/*
  Locația aleasă (din butonul „Locație", din filtre sau de pe hartă):
  - „Saturn, Constanța" → potrivim după oraș;
  - „Constanța" (fără virgulă) → oraș SAU județ cu acest nume.
*/
export function matchesPlace(unit: Unit, place: string | null) {
  if (!place) return true;
  const [uCity, uCounty = ""] = unit.location.split(",").map((x) => normalize(x.trim()));
  const [pCity, pCounty] = place.split(",").map((x) => normalize(x.trim()));
  if (pCounty !== undefined) return uCity === pCity;
  return uCity === pCity || uCounty === pCity;
}
