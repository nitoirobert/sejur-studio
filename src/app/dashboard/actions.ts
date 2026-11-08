"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import {
  manualBookingSchema,
  rpcErrorCode,
  schemaErrorCode,
  type BookingResult,
} from "@/components/dashboard/booking/schema";

// POST only (form action). Ends this browser's session and clears the sb-* cookies.
// scope "local": other devices of the same owner stay signed in.
// The sign-out button then turns this redirect into a full page load (Sidebar.tsx).
export async function signOut(): Promise<void> {
  await requireViewer(); // no session: straight to /login
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  // Failed (session kept): stay on the page; the button resets (SettledWatch in Sidebar.tsx).
  if (error) return;
  redirect("/login");
}

// Manual booking from the chart: session first, then a strict schema, then one RPC (guest + booking in
// one transaction). The organization comes from the session inside create_manual_booking; the client
// cannot send it, nor a status or source. Errors come back as codes; raw Postgres text never leaves.
// On success refresh() re-renders the page (chart + KPI) in the same response, so the optimistic bar
// is replaced by the real one without a second bar or a reload.
export async function createManualBooking(input: unknown): Promise<BookingResult> {
  await requireViewer();

  const parsed = manualBookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: schemaErrorCode(parsed.error) };
  const b = parsed.data;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_manual_booking", {
      p_unit_id: b.unit_id,
      p_check_in: b.check_in,
      p_check_out: b.check_out,
      p_full_name: b.full_name,
      p_email: b.email || undefined,
      p_phone: b.phone || undefined,
      p_adults: b.adults,
      p_children: b.children,
      p_total_amount: b.amount,
    });
    if (error || !data) {
      const code = error ? rpcErrorCode(error) : "generic";
      if (code === "generic") console.error("create_manual_booking failed", error?.code ?? "no data");
      return { ok: false, code };
    }
    refresh();
    return { ok: true, id: data };
  } catch {
    console.error("create_manual_booking threw");
    return { ok: false, code: "generic" };
  }
}
