import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "../../../supabase/types";
import { cookieOptions, supabaseEnv } from "./env";

// Server client for Server Components and Server Actions. One per request.
export async function createClient() {
  // Mark the render dynamic before anything (auth-js reads Date.now()) runs during prerender.
  await connection();
  const [store, head] = await Promise.all([cookies(), headers()]);
  const { url, key } = supabaseEnv();
  const host = head.get("x-forwarded-host") ?? head.get("host") ?? "";
  // As Next does: any "https" in the (possibly comma-joined) header means https.
  const proto = head.get("x-forwarded-proto")?.includes("https") ? "https" : "http";
  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  return createServerClient<Database>(url, key, {
    cookieOptions: cookieOptions(`${proto}:`, hostname),
    cookies: {
      getAll: () => store.getAll(),
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components cannot write cookies; the proxy already refreshed the session.
        }
      },
    },
  });
}
