import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/supabase/validation";

// Întoarcerea de la Google (OAuth) și din linkurile din email (confirmare cont, resetare parolă):
// schimbă codul primit pe o sesiune (cookie) și trimite vizitatorul mai departe.
// `next` acceptă doar căi interne; implicit, pagina principală.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next");
  const next = rawNext ? safeNext(rawNext) : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  // Link expirat sau anulat: înapoi pe site, cu popup-ul deschis și un mesaj.
  return NextResponse.redirect(new URL("/?auth=eroare", url.origin));
}
