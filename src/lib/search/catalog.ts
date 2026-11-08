import { units, type Unit } from "@/lib/mock-units";
import { normalize } from "@/lib/text";
import { frecency, type RecentEntry } from "./recent";

export type Place = { label: string; city: string; county: string; count: number };

// Destinații populare din România (pentru căutarea „ca într-un navigator").
// Mai târziu le putem lua dintr-un serviciu de hărți.
const popular: [city: string, county: string][] = [
  ["Brașov", "Brașov"],
  ["Poiana Brașov", "Brașov"],
  ["Predeal", "Brașov"],
  ["Râșnov", "Brașov"],
  ["Sinaia", "Prahova"],
  ["Bușteni", "Prahova"],
  ["Sibiu", "Sibiu"],
  ["Păltiniș", "Sibiu"],
  ["Sighișoara", "Mureș"],
  ["Sovata", "Mureș"],
  ["Cluj-Napoca", "Cluj"],
  ["Oradea", "Bihor"],
  ["Băile Felix", "Bihor"],
  ["Timișoara", "Timiș"],
  ["Băile Herculane", "Caraș-Severin"],
  ["Rânca", "Gorj"],
  ["Iași", "Iași"],
  ["Gura Humorului", "Suceava"],
  ["Vatra Dornei", "Suceava"],
  ["Câmpulung Moldovenesc", "Suceava"],
  ["Durău", "Neamț"],
  ["Borșa", "Maramureș"],
  ["Sighetu Marmației", "Maramureș"],
  ["Constanța", "Constanța"],
  ["Mamaia", "Constanța"],
  ["Vama Veche", "Constanța"],
  ["Sulina", "Tulcea"],
  ["București", "București"],
];

const split = (label: string) => {
  const [city, county = ""] = label.split(",").map((s) => s.trim());
  return { city, county };
};

// Câte unități avem în fiecare locație de pe site
const siteCounts = new Map<string, number>();
for (const u of units) siteCounts.set(u.location, (siteCounts.get(u.location) ?? 0) + 1);

export const places: Place[] = (() => {
  const map = new Map<string, Place>();
  for (const [label, count] of siteCounts) map.set(normalize(split(label).city), { label, ...split(label), count });
  for (const [city, county] of popular) {
    const key = normalize(city);
    if (!map.has(key)) map.set(key, { label: `${city}, ${county}`, city, county, count: 0 });
  }
  return [...map.values()];
})();

export const sitePlaces = places.filter((p) => p.count > 0);

// Județele în care avem cazări, cu numărul de unități
export const siteCounties: { county: string; count: number }[] = (() => {
  const map = new Map<string, number>();
  for (const p of sitePlaces) map.set(p.county, (map.get(p.county) ?? 0) + p.count);
  return [...map.entries()]
    .map(([county, count]) => ({ county, count }))
    .sort((a, b) => b.count - a.count);
})();

// Cuvintele pentru efectul de tastare din căutare: locații de pe site și nume de unități, alternativ.
// Primește unitățile deja traduse, ca numele să fie în limba curentă.
export function typewriterWords(list: Unit[] = units): string[] {
  const cities = sitePlaces.map((p) => p.city);
  const names = list.map((u) => u.name);
  const out: string[] = [];
  for (let i = 0; i < Math.max(cities.length, names.length); i++) {
    if (names[i]) out.push(names[i]);
    if (cities[i]) out.push(cities[i]);
  }
  return out;
}

/*
  Cât de bine se potrivește un text cu ce s-a tastat:
  3 = începe exact așa, 2 = un cuvânt din el începe așa, 1 = apare undeva, 0 = deloc.
*/
export function matchScore(label: string, query: string) {
  const l = normalize(label);
  const q = normalize(query.trim());
  if (!q) return 0;
  if (l.startsWith(q)) return 3;
  if (l.split(/[\s,.-]+/).some((w) => w.startsWith(q))) return 2;
  return l.includes(q) ? 1 : 0;
}

// Bonus pentru ce a mai căutat vizitatorul (maxim 2 puncte)
function recentBoost(label: string, recent: RecentEntry[], now: number) {
  const key = normalize(label);
  const hit = recent.find((r) => normalize(r.q) === key || key.startsWith(normalize(r.q)));
  return hit ? Math.min(frecency(hit, now), 2) : 0;
}

export function suggestPlaces(query: string, recent: RecentEntry[], now: number, limit = 7) {
  return places
    .map((p) => ({ p, s: matchScore(p.label, query) }))
    .filter((x) => x.s > 0)
    .map((x) => ({ ...x, s: x.s + (x.p.count > 0 ? 1.5 : 0) + recentBoost(x.p.label, recent, now) }))
    .sort((a, b) => b.s - a.s || a.p.label.localeCompare(b.p.label, "ro"))
    .slice(0, limit)
    .map((x) => x.p);
}

export function suggestUnits(
  query: string,
  recent: RecentEntry[],
  now: number,
  limit = 5,
  list: Unit[] = units, // unitățile în limba curentă
): Unit[] {
  return list
    .map((u) => ({ u, s: matchScore(u.name, query) }))
    .filter((x) => x.s > 0)
    .map((x) => ({ ...x, s: x.s + recentBoost(x.u.name, recent, now) + x.u.rating / 10 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.u);
}

// Completarea „fantomă": prima variantă care începe cu ce s-a tastat (fără să conteze diacriticele).
// Întoarce textul întreg, ca la acceptare să punem forma corectă („ca" → „Căsuța din Brazi").
export function completion(query: string, labels: string[]) {
  const q = normalize(query);
  if (!q) return "";
  return labels.find((l) => normalize(l).startsWith(q) && l.length > query.length) ?? "";
}
