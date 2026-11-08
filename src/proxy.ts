import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookieOptions, supabaseEnv } from "@/lib/supabase/env";
import { updateSession } from "@/lib/supabase/proxy";
import ro from "../messages/ro.json";

const PROPERTY_PAGE = /^\/dashboard\/proprietati\/([^/]+)\/?$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  return (await missingProperty(request, response)) ?? response;
}

/*
  With Cache Components the prerendered shell streams first, so a notFound() in the page keeps a 200.
  For a full page load of /dashboard/proprietati/:id the real 404 is decided here: an id that is not
  a UUID (or not even a valid escape), or a property the session cannot see (RLS: missing and another
  organization's look the same). One indexed select, only on this route, only for document loads
  (client navigations get the page's not-found UI as before).
*/
async function missingProperty(request: NextRequest, response: NextResponse): Promise<NextResponse | null> {
  const match = PROPERTY_PAGE.exec(request.nextUrl.pathname);
  if (!match || request.method !== "GET" || request.headers.has("rsc")) return null;
  // updateSession let the request through (no redirect to /login).
  if (response.headers.has("location")) return null;

  let id: string;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return notFoundResponse(response);
  }
  if (!UUID_RE.test(id)) return notFoundResponse(response);

  const { url, key } = supabaseEnv();
  // The request cookies already hold the session updateSession refreshed.
  const supabase = createServerClient(url, key, {
    cookieOptions: cookieOptions(request.nextUrl.protocol, request.nextUrl.hostname),
    cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} },
  });
  const { data, error } = await supabase.from("properties").select("id").eq("id", id).maybeSingle();
  // A query error is not a verdict: let the page decide.
  if (error || data !== null) return null;
  return notFoundResponse(response);
}

const nf = ro.Dashboard.properties.notFound;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`);

// A static page in the panel's night palette (globals.css .dark), no app shell and no second request.
const NOT_FOUND_HTML = `<!doctype html>
<html lang="ro" class="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(nf.title)}</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; box-sizing: border-box;
    background: #0d1626; color: #edf1f7; font: 15px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
  section { max-width: 34rem; width: 100%; box-sizing: border-box; padding: 28px; border-radius: 28px;
    background: #162236; border: 1px solid rgb(255 255 255 / 0.08);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.05), 0 14px 30px -16px rgb(0 0 0 / 0.65); }
  h1 { margin: 0; font: 400 2rem/1.2 Georgia, "Times New Roman", serif; }
  p { margin: 8px 0 20px; color: #b6c1d3; }
  a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: 999px;
    background: #1c2a41; color: #9cc1f0; font-weight: 600; text-decoration: none; }
  a:hover { color: #b9d4f6; }
  a:focus-visible { outline: 2px solid #9cc1f0; outline-offset: 2px; }
</style>
</head>
<body>
<section data-testid="property-not-found">
<h1>${esc(nf.title)}</h1>
<p>${esc(nf.body)}</p>
<a href="/dashboard/proprietati">&larr; ${esc(nf.back)}</a>
</section>
</body>
</html>`;

function notFoundResponse(response: NextResponse): NextResponse {
  const res = new NextResponse(NOT_FOUND_HTML, {
    status: 404,
    headers: { "Cache-Control": "private, no-store", "Content-Type": "text/html; charset=utf-8" },
  });
  // Keep the session cookies updateSession refreshed.
  response.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}

export const config = {
  // Skip build assets, image optimisation and public files (images, video, fonts, worker).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|webm|mjs|js|css|woff2?|json|txt|xml)$).*)",
  ],
};
