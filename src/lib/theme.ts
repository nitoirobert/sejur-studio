"use client";

import { useSyncExternalStore } from "react";

/*
  Tema (zi / noapte).
  - Clasa „dark" pe <html> schimbă toate culorile (vezi .dark în globals.css).
  - Alegerea se ține în localStorage; un mic script din layout o aplică înainte de prima afișare,
    ca pagina să nu „clipească" în tema greșită.
  - La schimbare pornim tranziția video (zi → noapte sau invers), dacă utilizatorul nu a cerut
    „mișcare redusă" în sistem.
*/

export type Theme = "light" | "dark";
export type Transition = { kind: "toNight" | "toDay"; id: number } | null;
type Snapshot = { theme: Theme; transition: Transition };

export const THEME_KEY = "sejur.theme";
const SERVER: Snapshot = { theme: "light", transition: null };

let snapshot: Snapshot | null = null;
const listeners = new Set<() => void>();

function read(): Snapshot {
  if (!snapshot) {
    snapshot = {
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      transition: null,
    };
  }
  return snapshot;
}

function emit(next: Snapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function setTheme(theme: Theme) {
  const root = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.classList.toggle("dark", theme === "dark");
  if (reduced) {
    // fără video: culorile trec lin, scurt
    root.classList.add("theme-anim");
    window.setTimeout(() => root.classList.remove("theme-anim"), 500);
  } else {
    // Cât rulează videoul oprim efectele grele (blur în spatele panourilor, tranziții pe toate
    // elementele), ca videoul să curgă fără sacadări. Culorile se schimbă instant, sub video.
    root.classList.add("theme-video");
  }
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* fără localStorage: tema rămâne doar pentru sesiunea curentă */
  }
  emit({
    theme,
    transition: reduced ? null : { kind: theme === "dark" ? "toNight" : "toDay", id: Date.now() },
  });
}

export function endTransition() {
  document.documentElement.classList.remove("theme-video");
  emit({ ...read(), transition: null });
}

export function useTheme() {
  return useSyncExternalStore(subscribe, read, () => SERVER);
}

// Scriptul rulat înainte de afișare (inline în <head>)
export const themeInitScript = `(function(){try{if(localStorage.getItem("${THEME_KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}})()`;
