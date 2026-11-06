// Oaspeții unui sejur: adulți, copii 2–5 ani și bebeluși 0–2 ani.
// Regula de capacitate: bebelușii (0–2 ani) NU ocupă loc, copiii de 2–5 ani DA.

export type GuestCounts = { guests: number; kids: number; infants: number };

export const LIMITS = { guests: { min: 1, max: 10 }, kids: { min: 0, max: 6 }, infants: { min: 0, max: 4 } };

// Câte locuri ocupă grupul (pentru comparația cu capacitatea unității)
export const occupancy = (g: GuestCounts) => g.guests + g.kids;

// Câți oaspeți în total (pentru afișare)
export const totalPeople = (g: GuestCounts) => g.guests + g.kids + g.infants;
