import fs from "node:fs";
import path from "node:path";
import { expect, type APIRequest, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ANON_KEY, OWNER1_STATE, SUPABASE_URL, admin, asUser, sessionFromStateFile } from "./helpers";
import { OWNER1_PROPS, OWNER2_PROP } from "./chart";

// Brief 04: every property the suite creates is named "E2E ..." and lives in owner1's (or owner2's)
// organization; deleteE2EProperties() removes them, their units, prices, photo rows and files.
export const PROP_PREFIX = "E2E ";
export const BUCKET = "photos";
export const runTag = () => String(Date.now()).slice(-7);

export const anon = (): SupabaseClient =>
  createClient(SUPABASE_URL(), ANON_KEY(), { auth: { persistSession: false, autoRefreshToken: false } });

export async function orgOfProperty(id: string): Promise<string> {
  const { data, error } = await admin().from("properties").select("organization_id").eq("id", id).single();
  if (error) throw error;
  return data.organization_id as string;
}
export const owner1Org = () => orgOfProperty(OWNER1_PROPS[0]);
export const owner2Org = () => orgOfProperty(OWNER2_PROP);

/** A property inserted with the admin key (fast setup for checks that do not test creation). */
export async function insertProperty(o: { org: string; name: string; status?: "activa" | "ascunsa"; instructions?: string }) {
  const slug = `e2e-${o.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await admin()
    .from("properties")
    .insert({
      organization_id: o.org,
      name: PROP_PREFIX + o.name,
      slug,
      city: "Brașov",
      status: o.status ?? "ascunsa",
      checkin_instructions: o.instructions ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** A unit + base price (bani) through the admin key. */
export async function insertUnit(o: { org: string; property: string; name: string; position?: number; published?: boolean; price?: number }) {
  const db = admin();
  const { data, error } = await db
    .from("units")
    .insert({
      organization_id: o.org,
      property_id: o.property,
      name: o.name,
      type: "camera",
      max_guests: 2,
      position: o.position ?? 0,
      is_published: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  const id = data.id as string;
  const { error: pe } = await db
    .from("unit_prices")
    .insert({ organization_id: o.org, unit_id: id, kind: "base", price_per_night: o.price ?? 30000, min_nights: 1 });
  if (pe) throw pe;
  if (o.published) {
    const { error: ue } = await db.from("units").update({ is_published: true }).eq("id", id);
    if (ue) throw ue;
  }
  return id;
}

/** Uploads a small WebP with the admin key and registers its photos row. */
export async function insertPhoto(o: { org: string; property: string; unit?: string | null; position: number; cover?: boolean }) {
  const db = admin();
  const p = `${o.org}/${o.property}/${crypto.randomUUID()}.webp`;
  const up = await db.storage.from(BUCKET).upload(p, TINY_WEBP, { contentType: "image/webp" });
  if (up.error) throw up.error;
  const { data, error } = await db
    .from("photos")
    .insert({
      organization_id: o.org,
      property_id: o.property,
      unit_id: o.unit ?? null,
      storage_path: p,
      alt: "E2E poză",
      position: o.position,
      is_cover: o.cover ?? false,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string, path: p };
}

export async function fileExists(p: string): Promise<boolean> {
  const [folder, ...rest] = [p.split("/").slice(0, 2).join("/"), p.split("/").slice(2).join("/")];
  const { data, error } = await admin().storage.from(BUCKET).list(folder, { search: rest.join("") });
  if (error) throw error;
  return (data ?? []).some((f) => f.name === rest.join(""));
}

export async function filesIn(org: string, property: string): Promise<string[]> {
  const { data, error } = await admin().storage.from(BUCKET).list(`${org}/${property}`, { limit: 1000 });
  if (error) throw error;
  return (data ?? []).filter((f) => f.id).map((f) => `${org}/${property}/${f.name}`);
}

/** Deletes every "E2E ..." property: its bookings (any guest), files, then the row (children cascade). */
export async function deleteE2EProperties(): Promise<number> {
  const db = admin();
  const { data: props, error } = await db.from("properties").select("id, organization_id").like("name", `${PROP_PREFIX}%`);
  if (error) throw error;
  for (const p of props ?? []) {
    const { data: units } = await db.from("units").select("id").eq("property_id", p.id);
    const unitIds = (units ?? []).map((u) => u.id as string);
    if (unitIds.length) {
      const { data: bookings } = await db.from("bookings").select("id, guest_id").in("unit_id", unitIds);
      const bIds = (bookings ?? []).map((b) => b.id as string);
      if (bIds.length) {
        await db.from("payments").delete().in("booking_id", bIds);
        const { error: be } = await db.from("bookings").delete().in("id", bIds);
        if (be) throw be;
      }
    }
    const files = await filesIn(p.organization_id as string, p.id as string);
    const { data: rows } = await db.from("photos").select("storage_path").eq("property_id", p.id);
    const all = [...new Set([...files, ...(rows ?? []).map((r) => r.storage_path as string)])];
    if (all.length) await db.storage.from(BUCKET).remove(all);
    const { error: de } = await db.from("properties").delete().eq("id", p.id);
    if (de) throw de;
  }
  return (props ?? []).length;
}

// ---------------------------------------------------------------------------------------------
// Server actions called directly (check 9): ids from the production build's manifest.
// ---------------------------------------------------------------------------------------------
type Manifest = { node: Record<string, { filename: string; exportedName: string }> };
export function actionId(name: string): string {
  const file = path.join(process.cwd(), ".next", "server", "server-reference-manifest.json");
  const m = JSON.parse(fs.readFileSync(file, "utf8")) as Manifest;
  const hit = Object.entries(m.node).find(
    ([, v]) => v.filename === "src/app/dashboard/proprietati/actions.ts" && v.exportedName === name,
  );
  if (!hit) throw new Error(`action ${name} not in the build manifest (rebuild?)`);
  return hit[0];
}

/** POSTs one server action like the browser does; returns the parsed { ok, code } result. */
export async function callAction(
  api: APIRequest,
  baseURL: string | undefined,
  state: string,
  route: string,
  name: string,
  input: unknown,
): Promise<{ status: number; result: { ok: boolean; code?: string } | null; body: string }> {
  const ctx = await api.newContext({ baseURL, storageState: state });
  const res = await ctx.post(route, {
    headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
    data: JSON.stringify([input]),
    maxRedirects: 0,
  });
  const body = await res.text();
  await ctx.dispose();
  // RSC payload: the action result is the line "1:{...}".
  const line = body.split("\n").find((l) => /^1:\{/.test(l));
  const result = line ? (JSON.parse(line.slice(2)) as { ok: boolean; code?: string }) : null;
  return { status: res.status(), result, body };
}

export const owner1Token = () => sessionFromStateFile(OWNER1_STATE).access_token;
export const owner1Client = () => asUser(owner1Token());

// ---------------------------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------------------------
// 1x1 lossless WebP.
export const TINY_WEBP = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");

/** Width and height from a WebP header (VP8, VP8L, VP8X). */
export function webpSize(buf: Buffer): { width: number; height: number } {
  expect(buf.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(buf.subarray(8, 12).toString("ascii")).toBe("WEBP");
  const kind = buf.subarray(12, 16).toString("ascii");
  if (kind === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  if (kind === "VP8L") {
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  if (kind === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  throw new Error(`unknown WebP chunk ${kind}`);
}

/** A JPEG of w x h drawn in the page (no image library in node). */
export async function makeJpeg(page: Page, w: number, h: number): Promise<Buffer> {
  const b64 = await page.evaluate(
    async ({ w, h }) => {
      const c = new OffscreenCanvas(w, h);
      const ctx = c.getContext("2d")!;
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#2a6f97");
      g.addColorStop(1, "#f4a259");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const blob = await c.convertToBlob({ type: "image/jpeg", quality: 0.8 });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = "";
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(s);
    },
    { w, h },
  );
  return Buffer.from(b64, "base64");
}

/** 11 MB that start like a JPEG: refused for size before any decoding. */
export const bigJpeg = () => {
  const b = Buffer.alloc(11 * 1024 * 1024, 0);
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return b;
};
export const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
export const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
