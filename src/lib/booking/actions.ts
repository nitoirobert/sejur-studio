"use server";

import { headers } from "next/headers";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { anonClient } from "@/lib/catalog/anon";
import { bookingSchema, clientIp, quoteSchema, toBookingError, zodErrorCode, type BookingError } from "./schema";
import { checkRateLimit } from "./rate-limit";

export type QuoteResult =
  | { ok: true; nights: number; total: number; currency: string; nightly: [string, number][] }
  | { ok: false; code: BookingError };

export type BookingResult = { ok: true; token: string } | { ok: false; code: BookingError };

// Price for the chosen dates, computed by the database (public_quote). Read-only, anon.
export async function getQuote(input: unknown): Promise<QuoteResult> {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: zodErrorCode(parsed.error) };
  const q = parsed.data;
  const { data, error } = await anonClient()
    .rpc("public_quote", {
      p_unit_id: q.unitId,
      p_check_in: q.checkIn,
      p_check_out: q.checkOut,
      p_adults: q.adults,
      p_children: q.children,
    })
    .single();
  if (error || !data) return { ok: false, code: "generic" };
  if (!data.ok || data.total === null || data.nights === null) return { ok: false, code: toBookingError(data.reason) };
  const nightly = Object.entries((data.nightly ?? {}) as Record<string, number>)
    .filter(([, v]) => typeof v === "number")
    .sort(([a], [b]) => a.localeCompare(b));
  return { ok: true, nights: data.nights, total: Number(data.total), currency: data.currency ?? "RON", nightly };
}

/*
  The booking request. Order: strict validation, IP limit (the only use of the service key),
  then create_public_booking with the session client only when there is a signed-in user
  (the database links the request to auth.uid()), otherwise the session-less client.
  No price is accepted from the browser; the database computes the total.
*/
export async function requestBooking(input: unknown): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: zodErrorCode(parsed.error) };
  const b = parsed.data;

  const h = await headers();
  const limit = await checkRateLimit("public_booking", clientIp((n) => h.get(n)));
  if (!limit.allowed) return { ok: false, code: "rate_limited" };

  const session = await createSessionClient();
  const { data: auth } = await session.auth.getUser();
  const client = auth.user ? session : anonClient();

  const { data, error } = await client
    .rpc("create_public_booking", {
      p_unit_id: b.unitId,
      p_check_in: b.checkIn,
      p_check_out: b.checkOut,
      p_full_name: b.fullName,
      p_email: b.email,
      p_phone: b.phone,
      p_adults: b.adults,
      p_children: b.children,
    })
    .single();
  if (error) return { ok: false, code: toBookingError(error.message) };
  if (!data?.public_token) return { ok: false, code: "generic" };
  return { ok: true, token: data.public_token };
}
