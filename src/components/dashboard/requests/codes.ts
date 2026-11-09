import { z } from "zod";

// Shared by the request buttons (client) and respondToRequest (server action).

export const REQUEST_ERRORS = ["booking_not_found", "hold_expired", "invalid_status", "unauthorized", "generic"] as const;
export type RequestErrorCode = (typeof REQUEST_ERRORS)[number];
export type Decision = "confirm" | "decline";
export type RequestResult = { ok: true } | { ok: false; code: RequestErrorCode };

export const PAGE_SIZE = 20;

export const respondSchema = z.strictObject({
  booking_id: z.guid(),
  decision: z.enum(["confirm", "decline"]),
});

/**
 * A PostgREST/Postgres error from confirm_booking / decline_booking -> a code.
 * The functions raise the code itself as the message (booking_not_found P0002, hold_expired,
 * invalid_status 22023). Raw Postgres text never leaves the server.
 */
export function respondErrorCode(error: { code?: string | null; message?: string | null }): RequestErrorCode {
  const code = error.code ?? "";
  const message = (error.message ?? "").trim();
  if (message === "booking_not_found" || message === "hold_expired" || message === "invalid_status") return message;
  if (code === "P0002" || code === "22P02") return "booking_not_found";
  if (code === "42501" || code.startsWith("PGRST3")) return "unauthorized";
  return "generic";
}

/** Page number from ?pagina=; anything odd is page 1. */
export function pageFromParam(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || !/^\d{1,4}$/.test(v)) return 1;
  return Math.max(1, Number(v));
}

/** Time left on a hold, rounded up to the minute; null once it is past. */
export function timeLeft(expiresAt: string, now: number): { hours: number; minutes: number } | null {
  const ms = Date.parse(expiresAt) - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const total = Math.ceil(ms / 60_000);
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
