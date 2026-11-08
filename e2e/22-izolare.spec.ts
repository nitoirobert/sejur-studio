import { expect, test } from "@playwright/test";
import { OWNER1_STATE, OWNER2_STATE, admin } from "./support/helpers";
import {
  BUCKET,
  anon,
  callAction,
  deleteE2EProperties,
  fileExists,
  insertPhoto,
  insertProperty,
  insertUnit,
  owner1Org,
  runTag,
} from "./support/props";

// Brief 04 checks 9 (owner2 posting owner1 ids to every server action changes nothing), 10 (anon
// never reads checkin_instructions) and 11 (hidden property / unpublished unit invisible to anon,
// files included). Plus the strict zod contract (extra key, unknown amenity).
const tag = runTag();
test.afterAll(async () => {
  await deleteE2EProperties();
});

/** Everything owner1 owns under one property, read with the admin key. */
async function snapshot(prop: string) {
  const db = admin();
  const [p, u, pr, ph] = await Promise.all([
    db.from("properties").select("*").eq("id", prop).single(),
    db.from("units").select("*").eq("property_id", prop).order("position"),
    db.from("unit_prices").select("*, units!inner(property_id)").eq("units.property_id", prop).order("id"),
    db.from("photos").select("*").eq("property_id", prop).order("position"),
  ]);
  return { property: p.data, units: u.data, prices: pr.data, photos: ph.data };
}

test("9: owner2 trimite id-urile lui owner1 la fiecare acțiune de server -> not_found, nimic nu se schimbă", async ({ playwright, baseURL }) => {
  const org = await owner1Org();
  const prop = await insertProperty({ org, name: `Izolare ${tag}`, instructions: "Cheia e sub preș." });
  const unit = await insertUnit({ org, property: prop, name: "E2E Camera izolare", published: true, price: 30000 });
  const unit2 = await insertUnit({ org, property: prop, name: "E2E Camera izolare 2", position: 1, price: 30000 });
  const db = admin();
  const ins = await db.from("unit_prices").insert([
    { organization_id: org, unit_id: unit, kind: "weekend", price_per_night: 40000, min_nights: 1, priority: 0 },
    { organization_id: org, unit_id: unit, kind: "season", price_per_night: 50000, min_nights: 1, date_from: "2027-08-01", date_to: "2027-09-01", priority: 0 },
  ]);
  expect(ins.error).toBeNull();
  const { data: season } = await db.from("unit_prices").select("id").eq("unit_id", unit).eq("kind", "season").single();
  const p0 = await insertPhoto({ org, property: prop, position: 0, cover: true });
  const p1 = await insertPhoto({ org, property: prop, unit, position: 1 });
  const before = await snapshot(prop);
  const route = `/dashboard/proprietati/${prop}`;

  const calls: [string, unknown][] = [
    [
      "updateProperty",
      {
        id: prop,
        name: "Furat",
        slug: `furat-${tag}`,
        description: "",
        address: "",
        city: "Cluj",
        lat: "",
        lng: "",
        check_in_time: "15:00",
        check_out_time: "11:00",
        checkin_instructions: "",
        amenities: [],
        status: "activa",
      },
    ],
    [
      "saveUnit",
      {
        id: unit,
        property_id: prop,
        name: "Furat",
        type: "camera",
        max_guests: 2,
        bedrooms: 1,
        beds: 1,
        bathrooms: 1,
        area_m2: "",
        description: "",
        amenities: [],
        is_published: false,
        base_price: "1",
      },
    ],
    [
      "saveUnit",
      {
        id: null,
        property_id: prop,
        name: "E2E Intrus",
        type: "camera",
        max_guests: 2,
        bedrooms: 1,
        beds: 1,
        bathrooms: 1,
        area_m2: "",
        description: "",
        amenities: [],
        is_published: false,
        base_price: "1",
      },
    ],
    ["reorderUnits", { property_id: prop, ids: [unit2, unit] }],
    ["saveBasePrice", { unit_id: unit, price: "1", min_nights: 1 }],
    ["saveWeekendPrice", { unit_id: unit, price: "1", min_nights: 1 }],
    ["deleteWeekendPrice", { unit_id: unit }],
    ["saveSeason", { id: season!.id, unit_id: unit, first_night: "2027-08-01", last_night: "2027-08-02", price: "1", min_nights: 1, priority: 0 }],
    ["saveSeason", { id: null, unit_id: unit, first_night: "2027-10-01", last_night: "2027-10-02", price: "1", min_nights: 1, priority: 0 }],
    ["deleteSeason", { id: season!.id }],
    ["preparePhotoUploads", { property_id: prop, count: 1 }],
    ["registerPhotos", { property_id: prop, photos: [{ path: `${org}/${prop}/${crypto.randomUUID()}.webp`, alt: "Furat", unit_id: null }] }],
    ["updatePhoto", { id: p1.id, alt: "Furat", unit_id: null }],
    ["reorderPhotos", { property_id: prop, ids: [p1.id, p0.id] }],
    ["setCoverPhoto", { id: p1.id }],
    ["deletePhoto", { id: p0.id }],
    ["deleteUnit", { id: unit2 }],
  ];
  const got: string[] = [];
  for (const [name, input] of calls) {
    const r = await callAction(playwright.request, baseURL, OWNER2_STATE, route, name, input);
    got.push(`${name}: ${r.status} ${JSON.stringify(r.result)}`);
    expect(r.result, `${name} ${r.body.slice(0, 200)}`).not.toBeNull();
    expect(r.result!.ok, name).toBe(false);
    expect(r.result!.code, name).toBe("not_found");
  }
  test.info().annotations.push({ type: "owner2", description: got.join(" | ") });

  // Control: the same call as owner1 works, so the refusals above are the ownership check.
  const own = await callAction(playwright.request, baseURL, OWNER1_STATE, route, "saveBasePrice", { unit_id: unit2, price: "350", min_nights: 1 });
  expect(own.result).toEqual({ ok: true });
  const after = await snapshot(prop);
  const base2 = (rows: typeof before.prices) => rows!.filter((r) => r.unit_id === unit2 && r.kind === "base");
  expect(base2(after.prices)[0].price_per_night).toBe(35000);
  // Everything else is exactly as before.
  const strip = (s: typeof before) => ({ ...s, prices: s.prices!.filter((r) => !(r.unit_id === unit2 && r.kind === "base")) });
  expect(strip(after)).toEqual(strip(before));
  expect(await fileExists(p0.path)).toBe(true);
  expect(await fileExists(p1.path)).toBe(true);
});

test("6 + 14: schema strictă: o cheie în plus (organization_id) -> invalid_input; facilitate necunoscută -> invalid_field", async ({ playwright, baseURL }) => {
  const org = await owner1Org();
  const prop = await insertProperty({ org, name: `Schema ${tag}` });
  const before = await snapshot(prop);
  const base = {
    id: prop,
    name: "E2E Schema",
    slug: `e2e-schema-${tag}`,
    description: "",
    address: "",
    city: "Brașov",
    lat: "",
    lng: "",
    check_in_time: "15:00",
    check_out_time: "11:00",
    checkin_instructions: "",
    amenities: [],
    status: "ascunsa",
  };
  const route = `/dashboard/proprietati/${prop}`;
  const extra = await callAction(playwright.request, baseURL, OWNER1_STATE, route, "updateProperty", { ...base, organization_id: crypto.randomUUID() });
  expect(extra.result).toMatchObject({ ok: false, code: "invalid_input" });
  const sauna = await callAction(playwright.request, baseURL, OWNER1_STATE, route, "updateProperty", { ...base, amenities: ["sauna"] });
  expect(sauna.result).toMatchObject({ ok: false, code: "invalid_field", field: "amenities" });
  const lat = await callAction(playwright.request, baseURL, OWNER1_STATE, route, "updateProperty", { ...base, lat: "95", lng: "25" });
  expect(lat.result).toMatchObject({ ok: false, code: "invalid_field", field: "lat" });
  expect(await snapshot(prop)).toEqual(before);
});

test("10: anonimul nu citește checkin_instructions; textul nu apare pe /", async ({ request }) => {
  const org = await owner1Org();
  const secret = `Codul ușii e 4471-${tag}`;
  const prop = await insertProperty({ org, name: `Instructiuni ${tag}`, status: "activa", instructions: secret });
  await insertUnit({ org, property: prop, name: "E2E Camera publică", published: true });
  const a = anon();
  const cols = await a.from("properties").select("id, name, slug, city").eq("id", prop);
  expect(cols.error).toBeNull();
  expect(cols.data).toHaveLength(1);
  const one = await a.from("properties").select("checkin_instructions").eq("id", prop);
  expect(one.data).toBeNull();
  expect(one.error?.code).toBe("42501");
  const star = await a.from("properties").select("*").eq("id", prop);
  expect(star.data ?? []).toEqual([]);
  expect(JSON.stringify(star.data ?? "")).not.toContain(secret);

  const home = await request.get("/", { headers: { cookie: "" } });
  expect(home.status()).toBe(200);
  expect(await home.text()).not.toContain(secret);
});

test("11: proprietate ascunsă și unitate nepublicată: anonimul nu vede rândurile, nici fișierele pozelor", async () => {
  const org = await owner1Org();
  const prop = await insertProperty({ org, name: `Vizibil ${tag}`, status: "activa" });
  const pub = await insertUnit({ org, property: prop, name: "E2E Publicată", published: true });
  const draft = await insertUnit({ org, property: prop, name: "E2E Ciornă", position: 1, published: false });
  const general = await insertPhoto({ org, property: prop, position: 0, cover: true });
  const ofPub = await insertPhoto({ org, property: prop, unit: pub, position: 1 });
  const ofDraft = await insertPhoto({ org, property: prop, unit: draft, position: 2 });
  const a = anon();
  const ids = async () => ({
    property: ((await a.from("properties").select("id").eq("id", prop)).data ?? []).map((r) => r.id),
    units: ((await a.from("units").select("id").eq("property_id", prop).order("position")).data ?? []).map((r) => r.id),
    prices: ((await a.from("unit_prices").select("unit_id").in("unit_id", [pub, draft])).data ?? []).map((r) => r.unit_id),
    photos: ((await a.from("photos").select("id").eq("property_id", prop).order("position")).data ?? []).map((r) => r.id),
  });
  const canRead = async (p: string) => (await a.storage.from(BUCKET).download(p)).error === null;

  // Active property: the published unit, its price, the general photo and the published unit's photo.
  expect(await ids()).toEqual({ property: [prop], units: [pub], prices: [pub], photos: [general.id, ofPub.id] });
  expect(await canRead(ofPub.path)).toBe(true);
  expect(await canRead(ofDraft.path), "photo of an unpublished unit").toBe(false);
  // A folder listing shows only the files anon may read anyway (not the unpublished unit's).
  const names = async () =>
    ((await a.storage.from(BUCKET).list(`${org}/${prop}`)).data ?? []).filter((f) => f.id).map((f) => `${org}/${prop}/${f.name}`).sort();
  expect(await names()).toEqual([general.path, ofPub.path].sort());

  // Hidden property: nothing at all.
  await admin().from("properties").update({ status: "ascunsa" }).eq("id", prop);
  expect(await ids()).toEqual({ property: [], units: [], prices: [], photos: [] });
  expect(await names()).toEqual([]);
  // Files never downloaded while public: refused at once.
  expect(await canRead(general.path), "general photo, not fetched before").toBe(false);
  expect(await canRead(ofDraft.path), "photo of the unpublished unit").toBe(false);
  const quote = await a.rpc("public_quote", { p_unit_id: pub, p_check_in: "2027-08-01", p_check_out: "2027-08-03", p_adults: 1, p_children: 0 });
  const q = (quote.data as { ok: boolean }[] | null)?.[0];
  expect(q?.ok ?? false, "public_quote on a hidden property").toBe(false);
  // A file anon downloaded while the property was public may still be served from the Storage cache
  // for at most 5 minutes (the panel uploads with cacheControl 300, decision 11); that is accepted.
  // What must hold at once: no new signed URL for it, and files never fetched while public stay refused.
  expect(await a.storage.from(BUCKET).createSignedUrl(ofPub.path, 60).then((r) => r.error !== null), "signed URL").toBe(true);
  expect(await a.storage.from(BUCKET).createSignedUrl(general.path, 60).then((r) => r.error !== null), "signed URL, never fetched").toBe(true);
  expect(await canRead(general.path), "general photo, still refused after the checks").toBe(false);
});
