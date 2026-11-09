"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

/*
  The guest's favourites (hearts), shared by every heart on the page.
  - Loaded once per page from `favorites` (RLS: only the signed-in user's rows).
  - Toggle is optimistic: the heart changes at once and rolls back if the database refuses.
  - Double click: upsert with ignoreDuplicates (no 23505) and one request in flight per unit.
  - Never sends user_id: the column defaults to auth.uid().
*/

type State = { ready: boolean; signedIn: boolean; ids: ReadonlySet<string>; failed: string | null };

let state: State = { ready: false, signedIn: false, ids: new Set(), failed: null };
const listeners = new Set<() => void>();
const inFlight = new Set<string>();
let started = false;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

async function load() {
  const sb = createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) {
    set({ ready: true, signedIn: false, ids: new Set() });
    return;
  }
  const { data: rows, error } = await sb.from("favorites").select("unit_id").limit(1000);
  set({ ready: true, signedIn: true, ids: new Set(error ? [] : (rows ?? []).map((r) => r.unit_id)) });
}

function start() {
  if (started) return;
  started = true;
  void load();
  createClient().auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") void load();
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const SERVER_STATE: State = { ready: false, signedIn: false, ids: new Set(), failed: null };

export function useFavorites() {
  useEffect(start, []);
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}

// Returns false when there is no account (the caller opens the sign-in window).
export async function toggleFavorite(unitId: string): Promise<boolean> {
  if (!state.signedIn) return false;
  if (inFlight.has(unitId)) return true;
  inFlight.add(unitId);
  const had = state.ids.has(unitId);
  const optimistic = new Set(state.ids);
  if (had) optimistic.delete(unitId);
  else optimistic.add(unitId);
  set({ ids: optimistic, failed: null });

  const sb = createClient();
  const { error } = had
    ? await sb.from("favorites").delete().eq("unit_id", unitId)
    : await sb.from("favorites").upsert({ unit_id: unitId }, { onConflict: "user_id,unit_id", ignoreDuplicates: true });
  inFlight.delete(unitId);

  if (error) {
    const rollback = new Set(state.ids);
    if (had) rollback.add(unitId);
    else rollback.delete(unitId);
    set({ ids: rollback, failed: unitId });
  }
  return true;
}
