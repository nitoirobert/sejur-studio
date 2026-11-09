import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types";
import { supabaseEnv } from "@/lib/supabase/env";

/*
  Requests per IP, counted in the database (rate_limit_hit, migration 0013). The service key is
  used here and nowhere else: only for this counter, never for the booking itself.
  Threshold and window come from env (BOOKING_RATE_LIMIT_MAX, BOOKING_RATE_LIMIT_WINDOW_SECONDS),
  defaults 5 per hour. The database stores the IP only as a salted hash.
  Without SUPABASE_SERVICE_ROLE_KEY (local dev) the limit is skipped with a warning; in
  production the request is refused instead, so a missing key never means "no limit".
*/

const intEnv = (name: string, fallback: number, max: number) => {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : fallback;
};

let warned = false;

export async function checkRateLimit(bucket: string, ip: string): Promise<{ allowed: boolean }> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    if (process.env.VERCEL_ENV === "production") return { allowed: false };
    if (!warned) console.warn("rate limit skipped: SUPABASE_SERVICE_ROLE_KEY is not set");
    warned = true;
    return { allowed: true };
  }
  const admin = createClient<Database>(supabaseEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await admin
    .rpc("rate_limit_hit", {
      p_bucket: bucket,
      p_ip: ip,
      p_max: intEnv("BOOKING_RATE_LIMIT_MAX", 5, 1_000_000),
      p_window_seconds: intEnv("BOOKING_RATE_LIMIT_WINDOW_SECONDS", 3600, 86_400),
    })
    .single();
  // A counter failure refuses the request rather than letting it through unlimited.
  if (error || !data) return { allowed: false };
  return { allowed: data.allowed };
}
