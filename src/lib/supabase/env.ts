// Only the two public values. The service key never appears in src/.
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return { url, key };
}

// Auth cookies: Lax everywhere. Secure in a production build when the origin is https, or
// localhost (browsers treat it as a secure origin). A production build on plain http elsewhere
// (a LAN IP) gets no Secure flag; otherwise the browser would drop the session cookie.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function cookieOptions(protocol: string, hostname: string) {
  const secureOrigin = protocol === "https:" || LOCAL_HOSTS.has(hostname);
  return {
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" && secureOrigin,
  };
}
