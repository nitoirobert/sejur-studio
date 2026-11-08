"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireViewer, type Viewer } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import {
  LIMITS,
  createPropertySchema,
  dbErrorCode,
  idSchema,
  issueResult,
  propertySchema,
  reorderSchema,
  unitSchema,
  type ActionResult,
  type FormErrorCode,
} from "@/components/dashboard/property/schema";
import { nextSlug, slugify } from "@/components/dashboard/property/slug";
import { basePriceSchema, sameRankOverlap, seasonSchema, weekendSchema } from "@/components/dashboard/prices/rules";

/*
  Every write of the properties area (brief 04). Each action: session first (requireViewer), then a
  strict zod schema, then queries that run as the signed-in owner, so RLS limits them to their
  organization. The organization is never read from the client: a parent row the owner can see
  supplies it. Updates and deletes ask for the changed ids back: 0 rows is "not_found", never a
  silent success. Errors come back as codes; raw Postgres text never leaves the server.
*/

type Client = Awaited<ReturnType<typeof createClient>>;
type DbError = { code?: string | null; message?: string | null };

/*
  reorder_units and save_unit arrive with migration 0010; until supabase/types.ts is regenerated they
  are called through this narrow signature (same argument names as the SQL functions).
*/
type UnitRpc = {
  (fn: "reorder_units", args: { p_property_id: string; p_unit_ids: string[] }): PromiseLike<{ data: null; error: DbError | null }>;
  (
    fn: "save_unit",
    args: {
      p_property_id: string;
      p_name: string;
      p_type: string;
      p_max_guests: number;
      p_bedrooms: number;
      p_beds: number;
      p_bathrooms: number;
      p_area_m2: number | null;
      p_description: string | null;
      p_amenities: string[];
      p_is_published: boolean;
      p_base_price: number;
      p_unit_id: string | null;
    },
  ): PromiseLike<{ data: string | null; error: DbError | null }>;
};
const unitRpc = (supabase: Client) => supabase.rpc.bind(supabase) as unknown as UnitRpc;

const BUCKET = "photos";
const MAX_BATCH = 20;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const fail = (code: FormErrorCode, extra?: { field?: string; suggestion?: string }) =>
  ({ ok: false, code, ...extra }) as const;

function dbFail(where: string, error: DbError): { ok: false; code: FormErrorCode } {
  const code = dbErrorCode(error);
  if (code === "generic") console.error(`${where} failed`, error.code ?? "no code");
  return { ok: false, code };
}

/** Session + client; requireViewer redirects to /login without a session. */
async function begin(): Promise<{ supabase: Client; viewer: Viewer }> {
  const viewer = await requireViewer();
  return { supabase: await createClient(), viewer };
}

async function run<R>(where: string, body: () => Promise<R>): Promise<R | { ok: false; code: "generic" }> {
  try {
    return await body();
  } catch (e) {
    // redirect() from requireViewer must keep propagating.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(`${where} threw`);
    return { ok: false, code: "generic" };
  }
}

async function propertyOrg(supabase: Client, id: string): Promise<string | null> {
  const { data } = await supabase.from("properties").select("organization_id").eq("id", id).maybeSingle();
  return data?.organization_id ?? null;
}

async function unitRow(supabase: Client, id: string) {
  const { data } = await supabase.from("units").select("organization_id, property_id").eq("id", id).maybeSingle();
  return data;
}

/** Positions 0..n-1 in the current order; keeps the cover or makes the first photo the cover. */
async function normalizePhotos(supabase: Client, propertyId: string): Promise<DbError | null> {
  const { data, error } = await supabase
    .from("photos")
    .select("id, is_cover")
    .eq("property_id", propertyId)
    .order("position")
    .order("created_at")
    .order("id")
    .limit(1000);
  if (error) return error;
  if (data.length === 0) return null;
  const cover = data.find((p) => p.is_cover)?.id ?? data[0].id;
  const res = await supabase.rpc("reorder_photos", {
    p_property_id: propertyId,
    p_photo_ids: data.map((p) => p.id),
    p_cover_id: cover,
  });
  return res.error;
}

// ---------------------------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------------------------

/** A new hidden property; the slug comes from the name and gets -2, -3 ... while it is taken. */
export async function createProperty(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { supabase, viewer } = await begin();
  return run("createProperty", async () => {
    const parsed = createPropertySchema.safeParse(input);
    if (!parsed.success) return issueResult(parsed.error);
    const { data: member } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", viewer.id)
      .order("created_at")
      .order("organization_id")
      .limit(1)
      .maybeSingle();
    if (!member) return fail("unauthorized");

    let slug = slugify(parsed.data.name);
    for (let i = 0; i < 25; i++) {
      const { data, error } = await supabase
        .from("properties")
        .insert({ organization_id: member.organization_id, name: parsed.data.name, city: parsed.data.city, slug, status: "ascunsa" })
        .select("id")
        .single();
      // The slug may belong to another organization (invisible through RLS): only 23505 tells.
      if (error?.code === "23505") {
        slug = nextSlug(slug);
        continue;
      }
      if (error || !data) return dbFail("createProperty", error ?? {});
      refresh();
      return { ok: true, id: data.id };
    }
    return fail("slug_taken");
  });
}

export async function updateProperty(input: unknown): Promise<ActionResult> {
  const { supabase } = await begin();
  return run("updateProperty", async () => {
    const parsed = propertySchema.safeParse(input);
    if (!parsed.success) return issueResult(parsed.error);
    const { id, ...p } = parsed.data;
    const { data, error } = await supabase
      .from("properties")
      .update({
        name: p.name,
        slug: p.slug,
        description: p.description,
        address: p.address,
        city: p.city,
        lat: p.lat,
        lng: p.lng,
        check_in_time: p.check_in_time,
        check_out_time: p.check_out_time,
        checkin_instructions: p.checkin_instructions,
        amenities: p.amenities,
        status: p.status,
      })
      .eq("id", id)
      .select("id");
    if (error?.code === "23505") return fail("slug_taken", { field: "slug", suggestion: nextSlug(p.slug) });
    if (error) return dbFail("updateProperty", error);
    if (data.length === 0) return fail("not_found");
    refresh();
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------------------------

/** Unit + base price in one transaction (save_unit, 0010). Publishing needs a base price > 0. */
export async function saveUnit(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { supabase } = await begin();
  return run("saveUnit", async () => {
    const parsed = unitSchema.safeParse(input);
    if (!parsed.success) return issueResult(parsed.error);
    const u = parsed.data;
    if (!(await propertyOrg(supabase, u.property_id))) return fail("not_found");
    const { data, error } = await unitRpc(supabase)("save_unit", {
      p_unit_id: u.id ?? null,
      p_property_id: u.property_id,
      p_name: u.name,
      p_type: u.type,
      p_max_guests: u.max_guests,
      p_bedrooms: u.bedrooms,
      p_beds: u.beds,
      p_bathrooms: u.bathrooms,
      p_area_m2: u.area_m2 ?? null,
      p_description: u.description ?? null,
      p_amenities: u.amenities,
      p_is_published: u.is_published,
      p_base_price: u.base_price,
    });
    if (error || !data) return dbFail("save_unit", error ?? {});
    refresh();
    return { ok: true, id: data };
  });
}

/** Refused while the unit has bookings. Its photo files go with it; positions stay 0..n-1. */
export async function deleteUnit(input: unknown): Promise<ActionResult> {
  const { supabase } = await begin();
  return run("deleteUnit", async () => {
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return issueResult(parsed.error);
    const unit = await unitRow(supabase, parsed.data.id);
    if (!unit) return fail("not_found");
    const { data: photos, error: photosError } = await supabase
      .from("photos")
      .select("storage_path")
      .eq("unit_id", parsed.data.id)
      .limit(1000);
    if (photosError) return dbFail("deleteUnit photos", photosError);

    const { data, error } = await supabase.from("units").delete().eq("id", parsed.data.id).select("id");
    if (error?.code === "23503") return fail("unit_has_bookings");
    if (error) return dbFail("deleteUnit", error);
    if (data.length === 0) return fail("not_found");

    if (photos.length > 0) {
      const removed = await supabase.storage.from(BUCKET).remove(photos.map((p) => p.storage_path));
      if (removed.error) console.error("deleteUnit: files not removed", photos.length);
    }
    const { data: rest } = await supabase
      .from("units")
      .select("id")
      .eq("property_id", unit.property_id)
      .order("position")
      .order("name")
      .limit(500);
    if (rest && rest.length > 0) {
      const r = await unitRpc(supabase)("reorder_units", { p_property_id: unit.property_id, p_unit_ids: rest.map((x) => x.id) });
      if (r.error) console.error("deleteUnit: reorder_units failed", r.error.code ?? "");
    }
    const n = await normalizePhotos(supabase, unit.property_id);
    if (n) console.error("deleteUnit: photo positions not normalized", n.code ?? "");
    refresh();
    return { ok: true };
  });
}

export async function reorderUnits(input: unknown): Promise<ActionResult> {
  const { supabase } = await begin();
  return run("reorderUnits", async () => {
    const parsed = reorderSchema.safeParse(input);
    if (!parsed.success) return issueResult(parsed.error);
    const { error } = await unitRpc(supabase)("reorder_units", {
      p_property_id: parsed.data.property_id,
      p_unit_ids: parsed.data.ids,
    });
    if (error) return dbFail("reorder_units", error);
    refresh();
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------------------------
// Photos: the browser resizes, asks for signed upload URLs, uploads, then registers the rows.
// ---------------------------------------------------------------------------------------------

const prepareSchema = z.strictObject({ property_id: z.guid(), count: z.number().int().min(1).max(MAX_BATCH) });

export async function preparePhotoUploads(input: unknown): Promise<ActionResult<{ uploads: { path: string; token: string }[] }>> {
  const { supabase } = await begin();
  return run("preparePhotoUploads", async () => {
    const parsed = prepareSchema.safeParse(input);
    if (!parsed.success) return issueResult(parsed.error);
    const { property_id, count } = parsed.data;
    const org = await propertyOrg(supabase, property_id);
    if (!org) return fail("not_found");
    const uploads: { path: string; token: string }[] = [];
    for (let i = 0; i < count; i++) {
      const path = `${org}/${property_id}/${randomUUID()}.webp`;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) {
        console.error("createSignedUploadUrl failed");
        return fail("upload_failed");
      }
      uploads.push({ path, token: data.token });
    }
    return { ok: true, uploads };
  });
}

const altText = z.string().trim().min(1).max(LIMITS.alt).regex(/^[^\p{Cc}]*$/u);

const registerSchema = z.strictObject({
  property_id: z.guid(),
  photos: z
    .array(z.strictObject({ path: z.string().max(200), alt: altText, unit_id: z.guid().nullable() }))
    .min(1)
    .max(MAX_BATCH),
});

/** Rows for uploaded files. If the rows cannot be written, the uploaded files are removed. */
export async function registerPhotos(input: unknown): Promise<ActionResult<{ ids: string[] }>> {
  const { supabase } = await begin();
  return run("registerPhotos", async () => {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) return issueResult(parsed.error);
    const { property_id, photos } = parsed.data;
    const org = await propertyOrg(supabase, property_id);
    if (!org) return fail("not_found");

    // Only paths this property could have been given: <org>/<property>/<uuid>.webp, nothing else.
    const own = new RegExp(`^${org}/${property_id}/${UUID}\\.webp$`);
    const paths = photos.map((p) => p.path);
    const cleanup = async () => {
      const mine = paths.filter((p) => own.test(p));
      if (mine.length > 0) await supabase.storage.from(BUCKET).remove(mine);
    };
    if (!paths.every((p) => own.test(p)) || new Set(paths).size !== paths.length) {
      await cleanup();
      return fail("invalid_input");
    }
    for (const path of paths) {
      const { data: exists } = await supabase.storage.from(BUCKET).exists(path);
      if (!exists) {
        await cleanup();
        return fail("upload_failed");
      }
    }

    const { count } = await supabase.from("photos").select("id", { count: "exact", head: true }).eq("property_id", property_id);
    const start = count ?? 0;
    const { data, error } = await supabase
      .from("photos")
      .insert(
        photos.map((p, i) => ({
          organization_id: org,
          property_id,
          unit_id: p.unit_id,
          storage_path: p.path,
          alt: p.alt,
          position: start + i,
        })),
      )
      .select("id");
    if (error || !data) {
      await cleanup();
      return dbFail("registerPhotos", error ?? {});
    }
    const n = await normalizePhotos(supabase, property_id);
    if (n) console.error("registerPhotos: positions not normalized", n.code ?? "");
    refresh();
    return { ok: true, ids: data.map((d) => d.id) };
  });
}

/** Drops files that were uploaded but will not be registered (a batch that failed half way). */
export async function discardPhotoUploads(input: unknown): Promise<ActionResult> {
  const { supabase } = await begin();
  return run("discardPhotoUploads", async () => {
    const parsed = z.strictObject({ property_id: z.guid(), paths: z.array(z.string().max(200)).min(1).max(MAX_BATCH) }).safeParse(input);
    if (!parsed.success) return issueResult(parsed.error);
    const org = await propertyOrg(supabase, parsed.data.property_id);
    if (!org) return fail("not_found");
    const own = new RegExp(`^${org}/${parsed.data.property_id}/${UUID}\\.webp$`);
    const paths = parsed.data.paths.filter((p) => own.test(p));
    if (paths.length === 0) return { ok: true };
    // Never a registered file: those go only through deletePhoto.
    const { data: used } = await supabase.from("photos").select("storage_path").in("storage_path", paths);
    const taken = new Set((used ?? []).map((u) => u.storage_path));
    const orphans = paths.filter((p) => !taken.has(p));
    if (orphans.length > 0) await supabase.storage.from(BUCKET).remove(orphans);
    return { ok: true };
  });
}

const photoSchema = z.strictObject({ id: z.guid(), alt: altText, unit_id: z.guid().nullable() });

export async function updatePhoto(input: unknown): Promise<ActionResult> {
  const { supabase } = await begin();
  return run("updatePhoto", async () => {
    const parsed = photoSchema.safeParse(input);
    if (!parsed.success) return issueResult(parsed.error);
    const { data, error } = await supabase
      .from("photos")
      .update({ alt: parsed.data.alt, unit_id: parsed.data.unit_id })
      .eq("id", parsed.data.id)
      .select("id");
    if (error) return dbFail("updatePhoto", error);
    if (data.length === 0) return fail("not_found");
    refresh();
    return { ok: true };
  });
}

/** The row and the file. If it was the cover, the first remaining photo becomes the cover. */
export async function deletePhoto(input: unknown): Promise<ActionResult> {
  const { supabase } = await begin();
  return run("deletePhoto", async () => {
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return issueResult(parsed.error);
    const { data, error } = await supabase
      .from("photos")
      .delete()
      .eq("id", parsed.data.id)
      .select("storage_path, property_id");
    if (error) return dbFail("deletePhoto", error);
    if (data.length === 0) return fail("not_found");
    const removed = await supabase.storage.from(BUCKET).remove([data[0].storage_path]);
    if (removed.error) console.error("deletePhoto: file not removed");
    const n = await normalizePhotos(supabase, data[0].property_id);
    if (n) console.error("deletePhoto: positions not normalized", n.code ?? "");
    refresh();
    return { ok: true };
  });
}

export async function reorderPhotos(input: unknown): Promise<ActionResult> {
  const { supabase } = await begin();
  return run("reorderPhotos", async () => {
    const parsed = reorderSchema.safeParse(input);
    if (!parsed.success) return issueResult(parsed.error);
    const { error } = await supabase.rpc("reorder_photos", {
      p_property_id: parsed.data.property_id,
      p_photo_ids: parsed.data.ids,
    });
    if (error) return dbFail("reorder_photos", error);
    refresh();
    return { ok: true };
  });
}

export async function setCoverPhoto(input: unknown): Promise<ActionResult> {
  const { supabase } = await begin();
  return run("setCoverPhoto", async () => {
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return issueResult(parsed.error);
    const { data: photo } = await supabase.from("photos").select("property_id").eq("id", parsed.data.id).maybeSingle();
    if (!photo) return fail("not_found");
    const { data: all, error } = await supabase
      .from("photos")
      .select("id")
      .eq("property_id", photo.property_id)
      .order("position")
      .order("created_at")
      .order("id")
      .limit(1000);
    if (error) return dbFail("setCoverPhoto", error);
    const res = await supabase.rpc("reorder_photos", {
      p_property_id: photo.property_id,
      p_photo_ids: all.map((p) => p.id),
      p_cover_id: parsed.data.id,
    });
    if (res.error) return dbFail("setCoverPhoto", res.error);
    refresh();
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------------------------
// Prices (unit_prices, bani). Rule: season > weekend > base (rules.ts, same as public_quote).
// ---------------------------------------------------------------------------------------------

export async function saveBasePrice(input: unknown): Promise<ActionResult> {
  const { supabase } = await begin();
  return run("saveBasePrice", async () => {
    const parsed = basePriceSchema.safeParse(input);
    if (!parsed.success) return issueResult(parsed.error);
    const { unit_id, price, min_nights } = parsed.data;
    const unit = await unitRow(supabase, unit_id);
    if (!unit) return fail("not_found");
    const { data, error } = await supabase
      .from("unit_prices")
      .update({ price_per_night: price, min_nights })
      .eq("unit_id", unit_id)
      .eq("kind", "base")
      .select("id");
    if (error) return dbFail("saveBasePrice", error);
    if (data.length === 0) {
      const ins = await supabase
        .from("unit_prices")
        .insert({ organization_id: unit.organization_id, unit_id, kind: "base", price_per_night: price, min_nights })
        .select("id");
      if (ins.error) return dbFail("saveBasePrice insert", ins.error);
    }
    refresh();
    return { ok: true };
  });
}

/** At most one weekend rule per unit: an existing one is updated, never doubled. */
export async function saveWeekendPrice(input: unknown): Promise<ActionResult> {
  const { supabase } = await begin();
  return run("saveWeekendPrice", async () => {
    const parsed = weekendSchema.safeParse(input);
    if (!parsed.success) return issueResult(parsed.error);
    const { unit_id, price, min_nights } = parsed.data;
    const unit = await unitRow(supabase, unit_id);
    if (!unit) return fail("not_found");
    const { data: existing, error } = await supabase
      .from("unit_prices")
      .select("id")
      .eq("unit_id", unit_id)
      .eq("kind", "weekend")
      .order("created_at", { ascending: false })
      .limit(2);
    if (error) return dbFail("saveWeekendPrice", error);
    if (existing.length > 1) return fail("weekend_exists");
    if (existing.length === 1) {
      const { data, error: upError } = await supabase
        .from("unit_prices")
        .update({ price_per_night: price, min_nights })
        .eq("id", existing[0].id)
        .select("id");
      if (upError) return dbFail("saveWeekendPrice", upError);
      if (data.length === 0) return fail("not_found");
    } else {
      const ins = await supabase
        .from("unit_prices")
        .insert({ organization_id: unit.organization_id, unit_id, kind: "weekend", price_per_night: price, min_nights })
        .select("id");
      if (ins.error) return dbFail("saveWeekendPrice insert", ins.error);
    }
    refresh();
    return { ok: true };
  });
}

export async function deleteWeekendPrice(input: unknown): Promise<ActionResult> {
  const { supabase } = await begin();
  return run("deleteWeekendPrice", async () => {
    const parsed = z.strictObject({ unit_id: z.guid() }).safeParse(input);
    if (!parsed.success) return issueResult(parsed.error);
    const { data, error } = await supabase
      .from("unit_prices")
      .delete()
      .eq("unit_id", parsed.data.unit_id)
      .eq("kind", "weekend")
      .select("id");
    if (error) return dbFail("deleteWeekendPrice", error);
    if (data.length === 0) return fail("not_found");
    refresh();
    return { ok: true };
  });
}

/**
  Two seasons may overlap only with different priorities (the higher wins). Equal priority on a
  shared night is refused here: the database has no constraint for it.
*/
export async function saveSeason(input: unknown): Promise<ActionResult> {
  const { supabase } = await begin();
  return run("saveSeason", async () => {
    const parsed = seasonSchema.safeParse(input);
    if (!parsed.success) return issueResult(parsed.error);
    const s = parsed.data;
    const unit = await unitRow(supabase, s.unit_id);
    if (!unit) return fail("not_found");
    const { data: seasons, error } = await supabase
      .from("unit_prices")
      .select("id, date_from, date_to, priority")
      .eq("unit_id", s.unit_id)
      .eq("kind", "season")
      .limit(1000);
    if (error) return dbFail("saveSeason", error);
    const others = seasons.map((x) => ({ id: x.id, dateFrom: x.date_from, dateTo: x.date_to, priority: x.priority }));
    if (sameRankOverlap(others, { id: s.id, dateFrom: s.date_from, dateTo: s.date_to, priority: s.priority })) {
      return fail("season_overlap", { field: "priority" });
    }
    const row = {
      price_per_night: s.price,
      date_from: s.date_from,
      date_to: s.date_to,
      min_nights: s.min_nights,
      priority: s.priority,
    };
    if (s.id) {
      const { data, error: upError } = await supabase
        .from("unit_prices")
        .update(row)
        .eq("id", s.id)
        .eq("unit_id", s.unit_id)
        .eq("kind", "season")
        .select("id");
      if (upError) return dbFail("saveSeason", upError);
      if (data.length === 0) return fail("not_found");
    } else {
      const ins = await supabase
        .from("unit_prices")
        .insert({ organization_id: unit.organization_id, unit_id: s.unit_id, kind: "season", ...row })
        .select("id");
      if (ins.error) return dbFail("saveSeason insert", ins.error);
    }
    refresh();
    return { ok: true };
  });
}

export async function deleteSeason(input: unknown): Promise<ActionResult> {
  const { supabase } = await begin();
  return run("deleteSeason", async () => {
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return issueResult(parsed.error);
    const { data, error } = await supabase.from("unit_prices").delete().eq("id", parsed.data.id).eq("kind", "season").select("id");
    if (error) return dbFail("deleteSeason", error);
    if (data.length === 0) return fail("not_found");
    refresh();
    return { ok: true };
  });
}
