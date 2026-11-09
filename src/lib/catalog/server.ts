import { cache } from "react";
import { connection } from "next/server";
import type { Unit } from "@/lib/mock-units";
import { anonClient } from "./anon";
import { toUnit, UUID_RE, type PropertyRow, type UnitRow } from "./map";

// Published units of active properties, read as anon (RLS decides what is public).
// Rendered per request: a unit published in the panel shows on the site without a rebuild,
// and the signed photo URLs are always fresh.

const SIGNED_URL_SECONDS = 60 * 60;
const MAX_UNITS = 500;

const UNIT_COLS =
  "id,name,type,max_guests,bedrooms,beds,bathrooms,area_m2,description,amenities,position,property_id";
// Explicit columns: never checkin_instructions.
const PROPERTY_COLS = "id,name,city,lat,lng,check_in_time,check_out_time";

async function load(unitId?: string): Promise<Unit[]> {
  await connection();
  const sb = anonClient();

  let unitQuery = sb
    .from("units")
    .select(UNIT_COLS)
    .eq("is_published", true)
    .order("property_id")
    .order("position")
    .limit(MAX_UNITS);
  if (unitId) unitQuery = unitQuery.eq("id", unitId);
  const { data: unitRows, error: unitError } = await unitQuery;
  if (unitError) throw new Error(`catalog units: ${unitError.code}`);
  const units = (unitRows ?? []) as UnitRow[];
  if (units.length === 0) return [];

  const propertyIds = [...new Set(units.map((u) => u.property_id))];
  const unitIds = units.map((u) => u.id);
  const [props, prices, photos] = await Promise.all([
    sb.from("properties").select(PROPERTY_COLS).eq("status", "activa").in("id", propertyIds),
    sb.from("unit_prices").select("unit_id,price_per_night").eq("kind", "base").in("unit_id", unitIds),
    sb
      .from("photos")
      .select("property_id,unit_id,storage_path,position,is_cover")
      .in("property_id", propertyIds)
      .order("position"),
  ]);
  if (props.error || prices.error || photos.error) {
    throw new Error(`catalog: ${(props.error ?? prices.error ?? photos.error)?.code}`);
  }

  const propertyById = new Map((props.data as PropertyRow[]).map((p) => [p.id, p]));
  const baseByUnit = new Map(prices.data.map((p) => [p.unit_id, p.price_per_night]));

  // A unit shows its own photos; without any, the property's photos (cover first).
  const photoRows = photos.data;
  const paths = [...new Set(photoRows.map((p) => p.storage_path))];
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await sb.storage.from("photos").createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const s of data ?? []) if (s.signedUrl && s.path) signed.set(s.path, s.signedUrl);
  }
  const urls = (rows: typeof photoRows) =>
    rows.map((r) => signed.get(r.storage_path)).filter((u): u is string => !!u);

  return units.flatMap((u) => {
    const property = propertyById.get(u.property_id);
    const base = baseByUnit.get(u.id);
    if (!property || !base) return []; // hidden property, or no price (cannot be booked)
    const own = photoRows.filter((p) => p.unit_id === u.id);
    const shared = photoRows
      .filter((p) => p.property_id === u.property_id && p.unit_id === null)
      .sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.position - b.position);
    return [toUnit(u, property, base, urls(own.length > 0 ? own : shared))];
  });
}

export const getPublishedUnits = cache(() => load());

export const getPublishedUnit = cache(async (id: string): Promise<Unit | null> => {
  if (!UUID_RE.test(id)) return null;
  const [unit] = await load(id.toLowerCase());
  return unit ?? null;
});

// Today in Europe/Bucharest (the database's calendar day) and the unit's busy days for the next
// year, for the booking form. Busy ranges are [from, to); the database re-checks on submit.
export async function getBookingContext(unitId: string): Promise<{ today: string; busy: { from: string; to: string }[] }> {
  await connection();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const to = new Date(`${today}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + 365);
  const { data } = await anonClient().rpc("public_busy_ranges", {
    p_unit_id: unitId,
    p_from: today,
    p_to: to.toISOString().slice(0, 10),
  });
  const busy = (data ?? []).map((r) => ({ from: r.busy_from, to: r.busy_to }));
  return { today, busy };
}
