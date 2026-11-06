"use client";

import { useSyncExternalStore } from "react";
import { normalize } from "@/lib/text";

/*
  Căutări recente ale vizitatorului.

  Unde le ținem: în localStorage (doar în browserul lui), NU în cookie-uri.
  Cookie-urile se trimit la server cu fiecare cerere – nu avem nevoie de asta,
  iar așa nu ajung date personale la noi (GDPR: minim de date).

  Algoritmul de ordonare: „frecency" = frecvență × recență.
  - o căutare folosită de mai multe ori urcă (logaritmic, ca să nu domine pentru totdeauna);
  - valoarea se înjumătățește la fiecare 7 zile de nefolosire.
*/

export type RecentKind = "search" | "location";
export type RecentEntry = { q: string; n: number; t: number }; // text, de câte ori, ultima dată (ms)
type Data = Record<RecentKind, RecentEntry[]>;

const KEY = "sejur.recent.v1";
const MAX_ENTRIES = 20;
const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;
const EMPTY: Data = { search: [], location: [] };

export function frecency(e: RecentEntry, now: number) {
  return (1 + Math.log(e.n)) * Math.pow(0.5, (now - e.t) / HALF_LIFE_MS);
}

// Adaugă (sau întărește) o căutare și păstrează doar cele mai valoroase MAX_ENTRIES
export function addEntry(list: RecentEntry[], q: string, now: number): RecentEntry[] {
  const text = q.trim();
  const key = normalize(text);
  if (key.length < 2) return list;
  const existing = list.find((e) => normalize(e.q) === key);
  const next = existing
    ? list.map((e) => (e === existing ? { q: text, n: e.n + 1, t: now } : e))
    : [...list, { q: text, n: 1, t: now }];
  return next.sort((a, b) => frecency(b, now) - frecency(a, now)).slice(0, MAX_ENTRIES);
}

export function rankRecent(list: RecentEntry[], now: number, limit = 5) {
  return [...list].sort((a, b) => frecency(b, now) - frecency(a, now)).slice(0, limit);
}

/* ---------- Stocare în browser, legată de React ---------- */

let cache: Data | null = null;
const listeners = new Set<() => void>();

function read(): Data {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Data>) : {};
    cache = { search: parsed.search ?? [], location: parsed.location ?? [] };
  } catch {
    cache = EMPTY; // localStorage indisponibil (ex. navigare privată strictă)
  }
  return cache;
}

function write(data: Data) {
  cache = data;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* nu putem salva – rămâne doar în memorie */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // sincronizare între tab-uri deschise
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function recordRecent(kind: RecentKind, q: string) {
  const data = read();
  write({ ...data, [kind]: addEntry(data[kind], q, Date.now()) });
}

export function clearRecent(kind: RecentKind) {
  write({ ...read(), [kind]: [] });
}

export function useRecent(kind: RecentKind) {
  return useSyncExternalStore(subscribe, read, () => EMPTY)[kind];
}
