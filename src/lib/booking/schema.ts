import { z } from "zod";
import { isIsoDate } from "@/lib/dates/days";

// Input of the public booking server actions. Strict: an extra field (e.g. a price sent by the
// browser) rejects the request; the price is only ever computed by the database.

const isoDate = z.string().refine(isIsoDate);

const quoteShape = {
  unitId: z.uuid(),
  checkIn: isoDate,
  checkOut: isoDate,
  adults: z.int().min(1).max(20),
  children: z.int().min(0).max(20),
};

export const quoteSchema = z.strictObject(quoteShape);
export type QuoteInput = z.infer<typeof quoteSchema>;

// Same limits as create_public_booking, so the form fails before the round trip.
export const PHONE_RE = /^[0-9 +().-]{6,32}$/;

export const bookingSchema = z.strictObject({
  ...quoteShape,
  fullName: z.string().trim().min(1).max(80),
  email: z.string().trim().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  phone: z.string().trim().regex(PHONE_RE),
});
export type BookingInput = z.infer<typeof bookingSchema>;

// Codes the database raises (error.message) plus our own; every one has a message in
// messages/<lang>.json under Booking.errors.
export const BOOKING_ERRORS = [
  "unit_not_found",
  "invalid_dates",
  "invalid_guest",
  "too_many_guests",
  "no_price",
  "min_nights",
  "invalid_amount",
  "unavailable",
  "too_many_requests",
  "rate_limited",
  "invalid_request",
  "generic",
] as const;
export type BookingError = (typeof BOOKING_ERRORS)[number];

export function toBookingError(code: unknown): BookingError {
  return typeof code === "string" && (BOOKING_ERRORS as readonly string[]).includes(code)
    ? (code as BookingError)
    : "generic";
}

// Which code a failed zod parse maps to: dates first, then guest counts, then contact fields.
export function zodErrorCode(error: z.ZodError): BookingError {
  const fields = new Set(error.issues.map((i) => String(i.path[0] ?? "")));
  if (error.issues.some((i) => i.code === "unrecognized_keys")) return "invalid_request";
  if (fields.has("unitId")) return "unit_not_found";
  if (fields.has("checkIn") || fields.has("checkOut")) return "invalid_dates";
  return "invalid_guest";
}

// First IP from the proxy headers (Vercel sets x-vercel-forwarded-for and x-real-ip).
export function clientIp(get: (name: string) => string | null): string {
  for (const name of ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"]) {
    const ip = get(name)?.split(",")[0]?.trim();
    if (ip) return ip.slice(0, 100);
  }
  return "unknown";
}
