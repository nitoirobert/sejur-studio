"use client";

import { useSyncExternalStore } from "react";

/*
  Acordul pentru cookie-uri (GDPR + Legea 506/2004).
  Categorii:
  - necessary: mereu active, fără acord (sesiunea de cont, limba aleasă, tema, căutările recente).
  - analytics: statistici de vizitare (ex. Google Analytics). Vercel Web Analytics nu folosește
    cookie-uri și nu cere acord.
  - marketing: pixeli pentru reclame și remarketing (Meta, Google Ads, TikTok).
  Alegerea stă 6 luni în cookie-ul `sejur_consent`; după aceea întrebăm din nou.
  Orice script de statistici/marketing se încarcă DOAR dacă useConsent() îl permite.
*/

export type Consent = { analytics: boolean; marketing: boolean; date: string; v: 1 };

const COOKIE = "sejur_consent";
const MAX_AGE = 60 * 60 * 24 * 182;
const EVENT = "sejur:consent";
const OPEN_EVENT = "sejur:cookie-settings";

function read(): Consent | null {
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw.slice(COOKIE.length + 1)));
    return value?.v === 1 ? (value as Consent) : null;
  } catch {
    return null;
  }
}

let cache: { raw: string; value: Consent | null } | null = null;
function snapshot(): Consent | null {
  const raw = document.cookie;
  if (cache?.raw !== raw) cache = { raw, value: read() };
  return cache.value;
}

export function saveConsent(choice: { analytics: boolean; marketing: boolean }) {
  const value: Consent = { ...choice, date: new Date().toISOString(), v: 1 };
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

// undefined = încă necunoscut (pe server / înainte de hidratare); null = n-a ales; altfel alegerea
export function useConsent(): Consent | null | undefined {
  return useSyncExternalStore(subscribe, snapshot, () => undefined);
}

// Redeschide fereastra de setări (ex. din linkul „Cookie-uri" din subsol / popup-ul de cont)
export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}
export const COOKIE_SETTINGS_EVENT = OPEN_EVENT;
