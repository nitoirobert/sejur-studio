"use client";

import { useSyncExternalStore } from "react";

// One shared clock for the "expiră în …" texts, ticking every 30 s. null during the server render
// and hydration, so the server's clock never has to match the browser's.
const TICK_MS = 30_000;
let now = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

// Cached between ticks (useSyncExternalStore needs a stable value); subscribe() refreshes it.
const snapshot = () => now || (now = Date.now());
const serverSnapshot = () => null;

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
