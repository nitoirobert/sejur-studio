import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types";
import { supabaseEnv } from "@/lib/supabase/env";

// Client without a session (anon key, no cookies) for the public site, per docs/DB.md
// "Ce citește anon": a signed-in owner must still see only what any visitor sees.
export function anonClient() {
  const { url, key } = supabaseEnv();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
