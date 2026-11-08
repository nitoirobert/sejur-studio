"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../../../supabase/types";
import { cookieOptions, supabaseEnv } from "./env";

// Browser client (session from cookies). Data loads on the server; this is for later client-side reads.
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient<Database>(url, key, {
    cookieOptions: cookieOptions(window.location.protocol, window.location.hostname),
  });
}
