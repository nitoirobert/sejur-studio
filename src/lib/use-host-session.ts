"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// Cine e logat în browser, doar pentru afișare (texte, butoane). Accesul real (panou, date)
// e verificat oricum pe server. Citește sesiunea din cookie, fără cerere la server
// decât dacă tokenul trebuie reîmprospătat. Pe server și până la prima citire: nimeni.

export type Account = { kind: "host" | "guest"; name: string | null; email: string | null } | null;

// Aceeași regulă ca trigger-ul din supabase/migrations/0012_guest_accounts.sql
function toAccount(session: Session | null): Account {
  const user = session?.user;
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  const provider = user.app_metadata?.provider;
  const guest = meta.account_type === "guest" || provider === "google" || provider === "apple";
  const name = (meta.full_name || meta.name || "").trim() || null;
  return { kind: guest ? "guest" : "host", name, email: user.email ?? null };
}

export function useAccount(): Account {
  const [account, setAccount] = useState<Account>(null);

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return; // fără chei Supabase (ex. un mediu fără panou): nimeni logat
    }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setAccount(toAccount(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setAccount(toAccount(session)));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return account;
}

// true doar pentru o GAZDĂ logată (butonul „Contul tău de gazdă")
export function useHostSignedIn() {
  return useAccount()?.kind === "host";
}
