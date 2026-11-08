import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookieOptions, supabaseEnv } from "./env";
import { safeNext } from "./validation";

const AUTH_PAGES = new Set(["/login", "/cont-nou"]);
const NO_STORE = "private, no-cache, no-store, max-age=0, must-revalidate";

function isDashboard(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

// Refreshes the Supabase session (getClaims) and gates /dashboard and the auth pages.
// Every other path passes through without an auth call.
export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const guarded = isDashboard(pathname);
  if (!guarded && !AUTH_PAGES.has(pathname)) return NextResponse.next();

  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();
  const supabase = createServerClient(url, key, {
    cookieOptions: cookieOptions(request.nextUrl.protocol, request.nextUrl.hostname),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet, headers) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Verifies the JWT (signature or Auth server) and refreshes an expired access token.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const redirectTo = (target: URL) => {
    const res = NextResponse.redirect(target);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    res.headers.set("Cache-Control", NO_STORE);
    return res;
  };

  if (guarded && !signedIn) {
    const target = new URL("/login", request.url);
    target.searchParams.set("next", pathname + search);
    return redirectTo(target);
  }
  // Only page loads bounce: a POST to /login or /cont-nou with a session reaches its action.
  if (!guarded && signedIn && (request.method === "GET" || request.method === "HEAD")) {
    return redirectTo(new URL(safeNext(request.nextUrl.searchParams.get("next")), request.url));
  }

  response.headers.set("Cache-Control", NO_STORE);
  return response;
}
