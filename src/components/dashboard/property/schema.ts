import { z } from "zod";
import { parseLei } from "@/components/dashboard/booking/schema";
import type { Database } from "../../../../supabase/types";
import { SLUG_MAX, SLUG_MIN, SLUG_RE } from "./slug";

/*
  Shared by the property forms (client) and the server actions in app/dashboard/proprietati/actions.ts.
  The server action is the gate; the client uses the same limits for input attributes and a first check.
  Every schema is strict: an extra key (organization_id, id of something else) fails the parse.
*/

export const AMENITIES = ["wifi", "parking", "breakfast", "kitchen", "fireplace", "pets", "ac", "view", "sea", "pool"] as const;
export type Amenity = (typeof AMENITIES)[number];

export const UNIT_TYPES = ["camera", "apartament", "garsoniera", "casuta"] as const satisfies readonly Database["public"]["Enums"]["unit_type"][];
export type UnitType = (typeof UNIT_TYPES)[number];

export const PROPERTY_STATUSES = ["activa", "ascunsa"] as const satisfies readonly Database["public"]["Enums"]["property_status"][];

export const LIMITS = {
  propertyName: 100,
  unitName: 80,
  description: 5000,
  unitDescription: 4000,
  address: 200,
  city: 80,
  instructions: 2000,
  alt: 200,
  maxGuests: 50,
  rooms: 50,
  beds: 100,
  area: 10_000,
} as const;

/** 21.000.000 lei: the highest price the panel accepts (int4 holds a bit more). */
export const PRICE_MAX_BANI = 2_100_000_000;

/** One shared vocabulary for every action in the properties area. Texts: Dashboard.formErrors.<code>. */
export const FORM_ERRORS = [
  "invalid_input",
  "invalid_field",
  "not_found",
  "slug_taken",
  "unit_has_bookings",
  "publish_needs_price",
  "season_overlap",
  "weekend_exists",
  "photo_set_mismatch",
  "upload_failed",
  "unauthorized",
  "generic",
] as const;
export type FormErrorCode = (typeof FORM_ERRORS)[number];

export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; code: FormErrorCode; field?: string; suggestion?: string };

const CONTROL = /^[^\p{Cc}]*$/u; // no tabs, newlines, NUL in one-line fields
const MULTI = /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/; // multi-line: newlines and tabs allowed

const line = (max: number) => z.string().trim().max(max).regex(CONTROL);
const required = (max: number) => line(max).min(1);
const optionalLine = (max: number) => line(max).transform((v) => v || null);
const text = (max: number) =>
  z
    .string()
    .max(max * 2) // raw cap before trim: no megabyte payloads
    .transform((v) => v.replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().max(max).regex(MULTI))
    .transform((v) => v || null);

/** A whole number typed in a field (or sent as a number). */
export const count = (min: number, max: number) =>
  z
    .union([z.number(), z.string().trim().regex(/^\d{1,7}$/).transform(Number)])
    .pipe(z.number().int().min(min).max(max));

/** Lei as typed ("450,50") -> bani, 1 ban .. 21.000.000 lei. Empty is refused. */
export const priceLei = z
  .string()
  .max(32)
  .transform((v, ctx) => {
    const bani = v.trim() === "" ? null : parseLei(v);
    if (bani === null || bani < 1 || bani > PRICE_MAX_BANI) {
      ctx.addIssue({ code: "custom", message: "price" });
      return z.NEVER;
    }
    return bani;
  });

const coordinate = (limit: number) =>
  z
    .union([z.number(), z.string().trim().max(24)])
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = typeof v === "number" ? v : Number(v.replace(",", "."));
      if (!Number.isFinite(n) || Math.abs(n) > limit) {
        ctx.addIssue({ code: "custom", message: "coordinate" });
        return z.NEVER;
      }
      return Math.round(n * 1e6) / 1e6;
    })
    .nullable();

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/)
  .transform((v) => v.slice(0, 5));

export const amenities = z
  .array(z.enum(AMENITIES))
  .max(AMENITIES.length)
  .transform((list) => AMENITIES.filter((a) => list.includes(a)));

export const createPropertySchema = z.strictObject({
  name: required(LIMITS.propertyName),
  city: optionalLine(LIMITS.city),
});

export const propertySchema = z
  .strictObject({
    id: z.guid(),
    name: required(LIMITS.propertyName),
    slug: z.string().trim().toLowerCase().min(SLUG_MIN).max(SLUG_MAX).regex(SLUG_RE),
    description: text(LIMITS.description),
    address: optionalLine(LIMITS.address),
    city: optionalLine(LIMITS.city),
    lat: coordinate(90),
    lng: coordinate(180),
    check_in_time: time,
    check_out_time: time,
    checkin_instructions: text(LIMITS.instructions),
    amenities,
    status: z.enum(PROPERTY_STATUSES),
  })
  .superRefine((v, ctx) => {
    // A pin is both coordinates or none.
    if ((v.lat === null) !== (v.lng === null)) ctx.addIssue({ code: "custom", path: ["lat"], message: "coordinate" });
  });
export type PropertyInput = z.input<typeof propertySchema>;

export const unitSchema = z.strictObject({
  id: z.guid().nullable(), // null: a new unit
  property_id: z.guid(),
  name: required(LIMITS.unitName),
  type: z.enum(UNIT_TYPES),
  max_guests: count(1, LIMITS.maxGuests),
  bedrooms: count(0, LIMITS.rooms),
  beds: count(0, LIMITS.beds),
  bathrooms: count(0, LIMITS.rooms),
  area_m2: z
    .union([z.literal(""), z.null(), count(1, LIMITS.area)])
    .transform((v) => (v === "" || v === null ? null : v)),
  description: text(LIMITS.unitDescription),
  amenities,
  is_published: z.boolean(),
  base_price: priceLei,
});
export type UnitInput = z.input<typeof unitSchema>;

export const idSchema = z.strictObject({ id: z.guid() });

export const reorderSchema = z.strictObject({
  property_id: z.guid(),
  ids: z.array(z.guid()).min(1).max(500),
});

/** The first issue decides: an unknown key is invalid_input, anything else names its field. */
export function issueResult(error: z.ZodError): { ok: false; code: FormErrorCode; field?: string } {
  const issue = error.issues[0];
  if (!issue || issue.code === "unrecognized_keys") return { ok: false, code: "invalid_input" };
  const field = String(issue.path[0] ?? "");
  if (field === "id" || field.endsWith("_id")) return { ok: false, code: "not_found" };
  if (!field) return { ok: false, code: "invalid_input" };
  return { ok: false, code: "invalid_field", field };
}

/** A Postgres/PostgREST error -> a code. Raw text never leaves the server. */
export function dbErrorCode(error: { code?: string | null; message?: string | null }): FormErrorCode {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (message.includes("photo_set_mismatch") || message.includes("unit_set_mismatch")) return "photo_set_mismatch";
  if (message.includes("not_found") || code === "P0002" || code === "22P02") return "not_found";
  if (message.includes("publish") || message.includes("base_price") || message.includes("no_price")) return "publish_needs_price";
  // A composite FK miss: the parent is in another organization (or gone). Deleting a unit with
  // bookings also raises 23503; deleteUnit maps that one itself.
  if (code === "23503") return "not_found";
  if (code === "23505") return "slug_taken";
  if (code === "23514" || code === "22023" || code === "22003") return "invalid_input";
  if (code === "42501" || code.startsWith("PGRST3")) return "unauthorized";
  return "generic";
}
