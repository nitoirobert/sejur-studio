"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// true dacă în browser există o sesiune de gazdă (cont din panoul proprietarului).
// Doar pentru afișare (textul unui buton): citește sesiunea din cookie, fără cerere la server
// decât dacă tokenul trebuie reîmprospătat. Accesul la panou e verificat oricum pe server.
// Pe server și până la prima citire întoarce false, deci implicit se vede „Cont nou de gazdă".
export function useHostSignedIn() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return; // fără chei Supabase (ex. un mediu fără panou): rămâne „nelogat"
    }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSignedIn(Boolean(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return signedIn;
}
