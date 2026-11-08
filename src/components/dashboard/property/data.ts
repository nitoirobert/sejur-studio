import { createClient } from "@/lib/supabase/server";
import { AMENITIES, type Amenity } from "./schema";
import type { PriceRule } from "@/components/dashboard/prices/rules";

/*
  Server reads of the properties area. They run as the signed-in owner: RLS limits every row to
  their organization, so another owner's id simply returns nothing (the page turns that into 404).
  Photos live in a private bucket: the page gets short-lived signed URLs, never the storage path alone.
*/

type Client = Awaited<ReturnType<typeof createClient>>;

export const PAGE_SIZE = 24;
const SIGNED_URL_SECONDS = 60 * 60;
const BUCKET = "photos";

export type PropertyCard = {
  id: string;
  name: string;
  city: string | null;
  status: "activa" | "ascunsa";
  units: number;
  coverUrl: string | null;
  coverAlt: string | null;
};

export type PropertyDetails = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  checkInTime: string;
  checkOutTime: string;
  checkinInstructions: string | null;
  amenities: Amenity[];
  status: "activa" | "ascunsa";
};

export type UnitRow = {
  id: string;
  name: string;
  type: "camera" | "apartament" | "garsoniera" | "casuta";
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  areaM2: number | null;
  description: string | null;
  amenities: Amenity[];
  isPublished: boolean;
  basePrice: number | null;
};

export type PhotoRow = {
  id: string;
  alt: string;
  unitId: string | null;
  isCover: boolean;
  url: string | null;
};

export const toAmenities = (raw: unknown): Amenity[] =>
  Array.isArray(raw) ? AMENITIES.filter((a) => raw.includes(a)) : [];

const hhmm = (t: string) => t.slice(0, 5);

async function signed(supabase: Client, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error || !data) return out;
  for (const d of data) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}

export async function loadPropertyList(page: number): Promise<{ items: PropertyCard[]; total: number }> {
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await supabase
    .from("properties")
    .select("id, name, city, status, units(count), photos(storage_path, alt, is_cover)", { count: "exact" })
    .eq("photos.is_cover", true)
    .order("name")
    .order("id")
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error("properties list failed");

  const covers = data.flatMap((p) => p.photos.slice(0, 1));
  const urls = await signed(
    supabase,
    covers.map((c) => c.storage_path),
  );
  const items = data.map((p) => {
    const cover = p.photos[0];
    return {
      id: p.id,
      name: p.name,
      city: p.city,
      status: p.status,
      units: p.units[0]?.count ?? 0,
      coverUrl: cover ? (urls.get(cover.storage_path) ?? null) : null,
      coverAlt: cover?.alt ?? null,
    };
  });
  return { items, total: count ?? items.length };
}

export async function loadProperty(id: string): Promise<PropertyDetails | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select("id, name, slug, description, address, city, lat, lng, check_in_time, check_out_time, checkin_instructions, amenities, status")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    description: data.description,
    address: data.address,
    city: data.city,
    lat: data.lat,
    lng: data.lng,
    checkInTime: hhmm(data.check_in_time),
    checkOutTime: hhmm(data.check_out_time),
    checkinInstructions: data.checkin_instructions,
    amenities: toAmenities(data.amenities),
    status: data.status,
  };
}

export async function loadUnits(propertyId: string): Promise<UnitRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select(
      "id, name, type, max_guests, bedrooms, beds, bathrooms, area_m2, description, amenities, is_published, unit_prices(kind, price_per_night)",
    )
    .eq("property_id", propertyId)
    .eq("unit_prices.kind", "base")
    .order("position")
    .order("name")
    .limit(500);
  if (error) throw new Error("units failed");
  return data.map((u) => ({
    id: u.id,
    name: u.name,
    type: u.type,
    maxGuests: u.max_guests,
    bedrooms: u.bedrooms,
    beds: u.beds,
    bathrooms: u.bathrooms,
    areaM2: u.area_m2,
    description: u.description,
    amenities: toAmenities(u.amenities),
    isPublished: u.is_published,
    basePrice: u.unit_prices[0]?.price_per_night ?? null,
  }));
}

export async function loadPhotos(propertyId: string): Promise<PhotoRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photos")
    .select("id, alt, unit_id, is_cover, storage_path")
    .eq("property_id", propertyId)
    .order("position")
    .order("created_at")
    .limit(1000);
  if (error) throw new Error("photos failed");
  const urls = await signed(
    supabase,
    data.map((p) => p.storage_path),
  );
  return data.map((p) => ({
    id: p.id,
    alt: p.alt ?? "",
    unitId: p.unit_id,
    isCover: p.is_cover,
    url: urls.get(p.storage_path) ?? null,
  }));
}

export async function loadPriceRules(unitId: string): Promise<PriceRule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_prices")
    .select("id, kind, price_per_night, date_from, date_to, min_nights, priority, created_at")
    .eq("unit_id", unitId)
    .order("kind")
    .order("date_from", { nullsFirst: true })
    .limit(500);
  if (error) throw new Error("prices failed");
  return data.map((r) => ({
    id: r.id,
    kind: r.kind,
    price: r.price_per_night,
    dateFrom: r.date_from,
    dateTo: r.date_to,
    minNights: r.min_nights,
    priority: r.priority,
    createdAt: r.created_at,
  }));
}

export async function bucharestToday(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bucharest_today");
  if (error || !data) throw new Error("bucharest_today failed");
  return data;
}
