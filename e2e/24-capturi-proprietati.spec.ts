import { expect, test } from "@playwright/test";
import { OWNER1_STATE, admin, axeAA, noCedilla, noHorizontalScroll, setTheme, watchConsole } from "./support/helpers";
import { addDays, bucharestToday } from "./support/chart";
import { BUCKET, deleteE2EProperties, insertProperty, insertUnit, owner1Org, runTag } from "./support/props";

// Brief 04 screenshots: the list and the 4 tabs at 1440 / 768 / 390, day and night, ro-RO,
// Europe/Bucharest. Each page: no horizontal scroll, no cedilla letters, clean console, no serious or
// critical axe violation (check 7: "Axe fără erori serioase").
test.use({ storageState: OWNER1_STATE, locale: "ro-RO", timezoneId: "Europe/Bucharest" });
const tag = runTag();
const DIR = "docs/briefs/04-capturi";
let prop = "";
let unit = "";

// Photos that match their alt text: a sky-over-hills scene and a warm room, drawn as WebP in the page.
const SCENES = [
  { alt: "E2E Dealuri verzi sub cer senin", sky: "#7fb7e6", ground: "#4f8a3c" },
  { alt: "E2E Cameră cu lumină caldă", sky: "#e9c79a", ground: "#8a5a3c" },
  { alt: "E2E Apus peste lac", sky: "#f2a35e", ground: "#2f5d7c" },
];

test.beforeAll(async ({ browser }) => {
  const org = await owner1Org();
  prop = await insertProperty({ org, name: `Pensiunea Ștefănița ${tag}`, status: "activa", instructions: "Cheile sunt la recepție." });
  const db = admin();
  await db
    .from("properties")
    .update({ description: "Pensiune liniștită la marginea pădurii, cu terasă și foc de tabără.", address: "Strada Poienii 12", lat: 45.6427, lng: 25.5887 })
    .eq("id", prop);
  unit = await insertUnit({ org, property: prop, name: "Camera Brădet", published: true, price: 35000 });
  await insertUnit({ org, property: prop, name: "Apartament Țarcu", position: 1, published: true, price: 52050 });
  await insertUnit({ org, property: prop, name: "Căsuța din livadă", position: 2, published: false, price: 41000 });
  const today = await bucharestToday();
  await db.from("unit_prices").insert([
    { organization_id: org, unit_id: unit, kind: "weekend", price_per_night: 42000, min_nights: 2, priority: 0 },
    { organization_id: org, unit_id: unit, kind: "season", price_per_night: 48000, min_nights: 2, priority: 0, date_from: addDays(today, 7), date_to: addDays(today, 15) },
  ]);
  const page = await browser.newPage();
  for (const [i, s] of SCENES.entries()) {
    const b64 = await page.evaluate(async (s) => {
      const c = new OffscreenCanvas(1200, 800);
      const x = c.getContext("2d")!;
      x.fillStyle = s.sky;
      x.fillRect(0, 0, 1200, 800);
      x.fillStyle = s.ground;
      x.beginPath();
      x.moveTo(0, 520);
      x.quadraticCurveTo(300, 380, 600, 500);
      x.quadraticCurveTo(900, 620, 1200, 460);
      x.lineTo(1200, 800);
      x.lineTo(0, 800);
      x.fill();
      const blob = await c.convertToBlob({ type: "image/webp", quality: 0.8 });
      const u = new Uint8Array(await blob.arrayBuffer());
      let str = "";
      for (let k = 0; k < u.length; k += 0x8000) str += String.fromCharCode(...u.subarray(k, k + 0x8000));
      return btoa(str);
    }, s);
    const p = `${org}/${prop}/${crypto.randomUUID()}.webp`;
    const up = await db.storage.from(BUCKET).upload(p, Buffer.from(b64, "base64"), { contentType: "image/webp" });
    if (up.error) throw up.error;
    const { error } = await db
      .from("photos")
      .insert({ organization_id: org, property_id: prop, unit_id: i === 1 ? unit : null, storage_path: p, alt: s.alt, position: i, is_cover: i === 0 });
    if (error) throw error;
  }
  await page.close();
});
test.afterAll(async () => {
  await deleteE2EProperties();
});

const PAGES = [
  { name: "lista", url: () => "/dashboard/proprietati", ready: "property-list" },
  { name: "detalii", url: () => `/dashboard/proprietati/${prop}?tab=detalii`, ready: "details-name" },
  { name: "unitati", url: () => `/dashboard/proprietati/${prop}?tab=unitati`, ready: "unit-row" },
  { name: "poze", url: () => `/dashboard/proprietati/${prop}?tab=poze`, ready: "photo-card" },
  { name: "preturi", url: () => `/dashboard/proprietati/${prop}?tab=preturi&unitate=${unit}`, ready: "price-preview" },
];

for (const width of [1440, 768, 390]) {
  for (const theme of ["light", "dark"] as const) {
    const mode = theme === "light" ? "zi" : "noapte";
    test(`capturi ${width}px ${mode}: listă + 4 file`, async ({ page, context }) => {
      test.setTimeout(120_000);
      const errors = watchConsole(page);
      const axeSerious: string[] = [];
      await setTheme(context, theme);
      await page.setViewportSize({ width, height: width === 390 ? 844 : width === 768 ? 1024 : 900 });
      for (const p of PAGES) {
        await page.goto(p.url());
        await expect(page.getByTestId(p.ready).first()).toBeVisible();
        await page.waitForLoadState("networkidle");
        // Every visible image has loaded (no broken photo in a screenshot); hidden lazy logos are skipped.
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect
          .poll(() =>
            page.evaluate(() => [...document.images].filter((i) => i.checkVisibility() && (!i.complete || i.naturalWidth === 0)).map((i) => i.src)),
          )
          .toEqual([]);
        await noHorizontalScroll(page);
        await noCedilla(page);
        await page.screenshot({ path: `${DIR}/${p.name}-${width}-${mode}.png`, fullPage: true });
        const axe = await axeAA(page);
        for (const v of axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical"))
          axeSerious.push(`${p.name}: ${v.id} (${v.impact}) x${v.nodes.length} ${String(v.nodes[0]?.target ?? "")}`);
      }
      expect(errors, "console").toEqual([]);
      expect(axeSerious, "axe serious/critical").toEqual([]);
    });
  }
}
