// Seeds the demo catalogue (scripts/catalog-data.mjs) into the linked Supabase project.
//   node scripts/seed-catalog.mjs photos   -> only download + convert photos into scripts/.photo-cache (no DB access)
//   node scripts/seed-catalog.mjs seed     -> create owner/org/properties/units/prices, upload photos, insert rows
//   node scripts/seed-catalog.mjs clean    -> remove the demo owner (cascades org, properties, units, photos rows) + files
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (never committed).
// Photos come from Wikimedia Commons (free licences only); credit is kept in photos.alt.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { OWNER, ORG, properties } from "./catalog-data.mjs";

const root = path.resolve(import.meta.dirname, "..");
const cacheDir = path.join(import.meta.dirname, ".photo-cache");
const UA = "SejurStudioDemoSeed/1.0 (demo catalogue seeding)";
const mode = process.argv[2];

for (const line of fs.existsSync(path.join(root, ".env.local")) ? fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

// ---------------------------------------------------------------- photos (Commons)
const OK_LICENCE = /^(CC0|CC BY(?!-NC)|CC BY-SA|Public domain|PD|Attribution)/i;
const strip = (s) => (s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
const usedTitles = new Set();

async function commons(query) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.search = new URLSearchParams({
    action: "query", format: "json", generator: "search", gsrnamespace: "6", gsrlimit: "30",
    gsrsearch: `${query} filetype:bitmap -painting -museum -conference -sign -ballroom -banquet -drawing -cat`, prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "1600",
  }).toString();
  let res;
  for (let attempt = 0; attempt < 5; attempt++) {
    res = await fetch(u, { headers: { "User-Agent": UA } });
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
  }
  if (!res.ok) throw new Error(`commons ${res.status}`);
  const json = await res.json();
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  return pages.flatMap((p) => {
    const i = p.imageinfo?.[0];
    if (!i || !/^image\/(jpeg|png)$/.test(i.mime)) return [];
    const md = i.extmetadata ?? {};
    const licence = strip(md.LicenseShortName?.value);
    const ratio = i.width / i.height;
    if (i.width < 1200 || ratio < 1.25 || ratio > 1.9 || !OK_LICENCE.test(licence)) return [];
    if (/logo|map|plan|diagram|flag|coat|poster|panorama/i.test(p.title)) return [];
    return [{ title: p.title, url: i.thumburl, licence, author: strip(md.Artist?.value).slice(0, 60) }];
  });
}

async function fetchPhotos(queries, n, tag) {
  const out = [];
  for (const q of queries) {
    if (out.length >= n) break;
    let cands = [];
    try { cands = await commons(q); } catch (e) { console.warn("  search failed:", q, e.message); }
    for (const c of cands) {
      if (out.length >= n) break;
      if (usedTitles.has(c.title)) continue;
      const file = path.join(cacheDir, `${tag}-${out.length}.webp`);
      try {
        const r = await fetch(c.url, { headers: { "User-Agent": UA } });
        if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toFile(file);
      } catch { continue; }
      usedTitles.add(c.title);
      const alt = `${c.title.replace(/^File:/, "").replace(/\.\w+$/, "")} - ${c.author || "autor necunoscut"} (${c.licence}, Wikimedia Commons)`.slice(0, 250);
      out.push({ file, alt });
      console.log(`  ${tag}-${out.length - 1}: ${c.title}`);
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  return out;
}

async function buildPhotoPlan() {
  fs.mkdirSync(cacheDir, { recursive: true });
  const plan = {};
  for (const p of properties) {
    console.log(`# ${p.name}`);
    plan[p.slug] = { cover: (await fetchPhotos([p.cityQ], 1, `${p.slug}-cover`))[0] ?? null, units: {} };
    for (const u of p.units) {
      const tag = `${p.slug}-${u.name.replace(/\W+/g, "-").toLowerCase()}`;
      plan[p.slug].units[u.name] = await fetchPhotos(u.q, 3, tag);
    }
  }
  fs.writeFileSync(path.join(cacheDir, "plan.json"), JSON.stringify(plan, null, 2));
  return plan;
}

// ---------------------------------------------------------------- database
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
const ok = (label, { error, data }) => {
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
};

async function findOwner(sb) {
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === OWNER.email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
}

async function clean(sb) {
  const owner = await findOwner(sb);
  if (!owner) return console.log("nothing to clean");
  const { data: mem } = await sb.from("organization_members").select("organization_id").eq("user_id", owner.id).maybeSingle();
  if (mem) {
    const org = mem.organization_id;
    const { data: files } = await sb.storage.from("photos").list(org, { limit: 1000 });
    for (const dir of files ?? []) {
      const { data: inner } = await sb.storage.from("photos").list(`${org}/${dir.name}`, { limit: 1000 });
      if (inner?.length) await sb.storage.from("photos").remove(inner.map((f) => `${org}/${dir.name}/${f.name}`));
    }
    ok("delete org", await sb.from("organizations").delete().eq("id", org));
  }
  ok("delete user", await sb.auth.admin.deleteUser(owner.id));
  console.log("demo catalogue removed");
}

async function seed(sb) {
  let owner = await findOwner(sb);
  if (owner) throw new Error(`${OWNER.email} already exists: run "clean" first`);
  const password = crypto.randomBytes(18).toString("base64url"); // random, never printed: log in via password reset if needed
  const created = ok("create owner", await sb.auth.admin.createUser({
    email: OWNER.email, password, email_confirm: true, user_metadata: { full_name: OWNER.full_name },
  }));
  owner = created.user;
  const mem = ok("membership", await sb.from("organization_members").select("organization_id").eq("user_id", owner.id).single());
  const org = mem.organization_id;
  ok("org", await sb.from("organizations").update({ name: ORG.name, slug: ORG.slug }).eq("id", org));

  const planFile = path.join(cacheDir, "plan.json");
  const plan = fs.existsSync(planFile) ? JSON.parse(fs.readFileSync(planFile, "utf8")) : await buildPhotoPlan();

  const upload = async (propertyId, photo) => {
    const storagePath = `${org}/${propertyId}/${crypto.randomUUID()}.webp`;
    const { error } = await sb.storage.from("photos").upload(storagePath, fs.readFileSync(photo.file), { contentType: "image/webp" });
    if (error) throw new Error(`upload: ${error.message}`);
    return storagePath;
  };

  let units = 0, photos = 0;
  for (const p of properties) {
    const prop = ok("property", await sb.from("properties").insert({
      organization_id: org, name: p.name, slug: p.slug, description: p.description, address: p.address, city: p.city,
      lat: p.lat, lng: p.lng, amenities: p.amenities, status: "activa",
      check_in_time: p.checkin, check_out_time: p.checkout,
      checkin_instructions: "Instrucțiuni de sosire trimise după confirmarea rezervării (date demo).",
    }).select("id").single());
    let pos = 0;
    const cover = plan[p.slug]?.cover;
    if (cover) {
      const sp = await upload(prop.id, cover);
      ok("cover", await sb.from("photos").insert({ organization_id: org, property_id: prop.id, storage_path: sp, position: pos++, is_cover: true, alt: cover.alt }));
      photos++;
    }
    let up = 0;
    for (const u of p.units) {
      const unit = ok("unit", await sb.from("units").insert({
        organization_id: org, property_id: prop.id, name: u.name, type: u.type, max_guests: u.guests, bedrooms: u.bedrooms,
        beds: u.beds, bathrooms: u.baths, area_m2: u.m2, description: u.desc, amenities: u.amenities, position: up++, is_published: false,
      }).select("id").single());
      ok("prices", await sb.from("unit_prices").insert([
        { organization_id: org, unit_id: unit.id, kind: "base", price_per_night: u.price * 100, min_nights: u.min, priority: 0 },
        { organization_id: org, unit_id: unit.id, kind: "weekend", price_per_night: u.weekend * 100, min_nights: u.min, priority: 10 },
      ]));
      for (const photo of plan[p.slug]?.units?.[u.name] ?? []) {
        const sp = await upload(prop.id, photo);
        ok("photo", await sb.from("photos").insert({ organization_id: org, property_id: prop.id, unit_id: unit.id, storage_path: sp, position: pos++, is_cover: false, alt: photo.alt }));
        photos++;
      }
      ok("publish", await sb.from("units").update({ is_published: true }).eq("id", unit.id)); // after the price exists
      units++;
    }
    console.log(`ok: ${p.name}`);
  }
  console.log(`done: ${properties.length} properties, ${units} units, ${photos} photos (owner ${OWNER.email})`);
}

if (mode === "photos") await buildPhotoPlan();
else if (mode === "seed") await seed(admin());
else if (mode === "clean") await clean(admin());
else console.log("usage: node scripts/seed-catalog.mjs photos|seed|clean");
