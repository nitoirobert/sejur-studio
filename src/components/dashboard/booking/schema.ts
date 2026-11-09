import { z } from "zod";
import { diffDays, isIsoDate } from "@/lib/dates/days";

// Shared by the manual-booking form (client) and createManualBooking (server action).
// The server action is the gate; the client uses the same limits for input attributes.

export const INT4_MAX = 2_147_483_647;
export const MAX_NIGHTS = 366;
export const NAME_MAX = 80;
export const PHONE_MAX = 32;
export const EMAIL_MAX = 254;
export const ADULTS_MAX = 20;
export const CHILDREN_MAX = 20;

/** Error codes the action returns; each has a Romanian text under Dashboard.booking.errors. */
export const BOOKING_ERRORS = [
  "invalid_input",
  "invalid_dates",
  "invalid_guest",
  "invalid_amount",
  "unit_not_found",
  "booking_overlap",
  "unauthorized",
  "generic",
] as const;
export type BookingErrorCode = (typeof BOOKING_ERRORS)[number];

export type BookingResult = { ok: true; id: string } | { ok: false; code: BookingErrorCode };

/**
 * Lei as typed by a person -> integer bani, or null.
 * Accepts "450", "450,50", "450.50", "1.234,50", "1 234,50". Empty means 0.
 * Refuses more than 2 decimals, signs, letters and anything above INT4_MAX bani.
 */
export function parseLei(raw: string): number | null {
  const s = raw.replace(/[\s  ]/g, "");
  if (s === "") return 0;
  let whole: string;
  let frac: string;
  const grouped = /^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/.exec(s); // 1.234,50: dots group thousands
  const plain = /^(\d+)(?:[,.](\d{1,2}))?$/.exec(s); // 450,50 or 450.50: one separator, 1-2 decimals
  // "1.500" or "450.505": one dotted group and no comma is ambiguous (thousands or 3 decimals), refuse it.
  if (grouped && grouped[2] === undefined && grouped[1].split(".").length === 2) return null;
  if (grouped) {
    whole = grouped[1].replace(/\./g, "");
    frac = grouped[2] ?? "";
  } else if (plain) {
    whole = plain[1];
    frac = plain[2] ?? "";
  } else {
    return null;
  }
  if (whole.replace(/^0+/, "").length > 8) return null; // past 99 999 999 lei is past INT4_MAX anyway
  const bani = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(bani) && bani <= INT4_MAX ? bani : null;
}

const count = (min: number, max: number) =>
  z
    .union([z.number(), z.string().trim().regex(/^\d{1,3}$/).transform(Number)])
    .pipe(z.number().int().min(min).max(max));

export const manualBookingSchema = z
  .strictObject({
    unit_id: z.guid(),
    check_in: z.string().refine(isIsoDate),
    check_out: z.string().refine(isIsoDate),
    full_name: z
      .string()
      .trim()
      .min(1)
      .max(NAME_MAX)
      .regex(/^[^\p{Cc}]*$/u), // no control characters (tabs, newlines, NUL)
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(EMAIL_MAX)
      .pipe(z.union([z.literal(""), z.email()]))
      .optional(),
    phone: z.string().trim().max(PHONE_MAX).optional(),
    adults: count(1, ADULTS_MAX),
    children: count(0, CHILDREN_MAX),
    amount: z
      .string()
      .max(32)
      .transform((v, ctx) => {
        const bani = parseLei(v);
        if (bani === null) {
          ctx.addIssue({ code: "custom", message: "invalid_amount" });
          return z.NEVER;
        }
        return bani;
      }),
  })
  .superRefine((v, ctx) => {
    if (!isIsoDate(v.check_in) || !isIsoDate(v.check_out)) return; // already reported above
    const nights = diffDays(v.check_in, v.check_out);
    if (nights < 1 || nights > MAX_NIGHTS) {
      ctx.addIssue({ code: "custom", path: ["check_out"], message: "invalid_dates" });
    }
  });

export type ManualBookingInput = z.input<typeof manualBookingSchema>;

const GUEST_FIELDS = new Set(["full_name", "email", "phone", "adults", "children"]);

/** One code for a failed parse: the first issue decides. */
export function schemaErrorCode(error: z.ZodError): BookingErrorCode {
  const issue = error.issues[0];
  if (!issue || issue.code === "unrecognized_keys") return "invalid_input";
  const field = String(issue.path[0] ?? "");
  if (field === "check_in" || field === "check_out") return "invalid_dates";
  if (field === "amount") return "invalid_amount";
  if (field === "unit_id") return "unit_not_found";
  if (GUEST_FIELDS.has(field)) return "invalid_guest";
  return "invalid_input";
}

const RPC_MESSAGES = new Set<string>(["invalid_dates", "invalid_guest", "invalid_amount"]);

/** A PostgREST/Postgres error from create_manual_booking -> a code. Raw text never leaves the server. */
export function rpcErrorCode(error: { code?: string | null; message?: string | null }): BookingErrorCode {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (code === "23P01") return "booking_overlap";
  if (code === "P0002" || code === "22P02" || code === "23503") return "unit_not_found";
  if (code === "22023") return RPC_MESSAGES.has(message) ? (message as BookingErrorCode) : "invalid_input";
  if (code === "42501" || code.startsWith("PGRST3")) return "unauthorized";
  return "generic";
}
