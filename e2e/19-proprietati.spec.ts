import { expect, test, type Page } from "@playwright/test";
import { OWNER1_STATE, OWNER2_STATE, admin, watchConsole } from "./support/helpers";
import { insertBooking, OWNER2_PROP } from "./support/chart";
import {
  deleteE2EProperties,
  fileExists,
  insertPhoto,
  insertProperty,
  insertUnit,
  owner1Org,
  runTag,
} from "./support/props";

// Brief 04 checks 1, 2, 6, 13, 14, 15 and 3/16 (units). Everything is named "E2E ..." and removed in afterAll.
test.use({ storageState: OWNER1_STATE });
// Default mode: the first four share the property from check 1; the rest set up their own data,
// so a failure does not hide the checks after it.
test.describe.configure({ mode: "default" });

const tag = runTag();
const NAME = `E2E Casa Ștefăniță ${tag}`;
const SLUG = `e2e-casa-stefanita-${tag}`;
let propId = "";
let secondId = "";
let errors: string[] = [];

test.beforeEach(({ page }) => {
  errors = watchConsole(page);
});
test.afterEach(() => {
  expect(errors, "console").toEqual([]);
});
test.afterAll(async () => {
  await deleteE2EProperties();
});

async function createViaUi(page: Page, name: string): Promise<string> {
  await page.goto("/dashboard/proprietati");
  await page.getByTestId("property-add").click();
  await page.getByTestId("property-create-name").fill(name);
  await page.getByTestId("property-create-city").fill("Brașov");
  await page.getByTestId("property-create-submit").click();
  await expect(page).toHaveURL(/\/dashboard\/proprietati\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("property-detail")).toBeVisible();
  const id = page.url().split("/").pop()!;
  // Bug (reported): the create sheet stays a modal <dialog> in the hidden list route and blocks every
  // click until a reload. The flows below reload; the bug has its own test at the end.
  await page.reload();
  await expect(page.getByTestId("property-detail")).toBeVisible();
  return id;
}

test("1: owner1 adaugă o proprietate: apare în listă și în filtrul graficului; owner2 primește 404", async ({ page, browser }) => {
  propId = await createViaUi(page, NAME);
  const { data } = await admin().from("properties").select("organization_id, status, slug").eq("id", propId).single();
  expect(data!.organization_id).toBe(await owner1Org());
  expect(data!.status).toBe("ascunsa");

  await page.goto("/dashboard/proprietati");
  const card = page.locator(`[data-testid="property-card"][data-property-id="${propId}"]`);
  await expect(card.getByTestId("property-card-name")).toHaveText(NAME);
  // Check 13: no cover yet, the card still renders its placeholder.
  await expect(card.getByTestId("property-card-nocover")).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.locator(`[data-testid="chart-property-filter"] option[value="${propId}"]`)).toHaveText(NAME);

  const ctx = await browser.newContext({ storageState: OWNER2_STATE });
  const p2 = await ctx.newPage();
  const res = await p2.goto(`/dashboard/proprietati/${propId}`);
  await expect(p2.getByTestId("property-not-found")).toBeVisible();
  // The not-found screen is the contract; the HTTP code is recorded (streamed pages may answer 200).
  test.info().annotations.push({ type: "status", description: `owner2 GET other property: HTTP ${res!.status()}` });
  await expect(p2.getByText(NAME)).toHaveCount(0);
  await p2.goto("/dashboard/proprietati");
  await expect(p2.locator(`[data-property-id="${propId}"]`)).toHaveCount(0);
  await p2.goto("/dashboard");
  await expect(p2.locator(`[data-testid="chart-property-filter"] option[value="${propId}"]`)).toHaveCount(0);
  await ctx.close();
});

test("6: slug din nume cu diacritice transliterate; duplicat -> -2; slugul altei firme -> sugestie", async ({ page }) => {
  await page.goto(`/dashboard/proprietati/${propId}`);
  await expect(page.getByTestId("details-slug")).toHaveValue(SLUG);

  secondId = await createViaUi(page, NAME);
  await expect(page.getByTestId("details-slug")).toHaveValue(`${SLUG}-2`);

  // owner2's slug is invisible to owner1 (RLS): only the unique violation tells.
  const { data: o2 } = await admin().from("properties").select("slug").eq("id", OWNER2_PROP).single();
  await page.getByTestId("details-slug").fill(o2!.slug);
  await page.getByTestId("details-submit").click();
  const use = page.getByTestId("details-slug-use-suggestion");
  await expect(use).toBeVisible();
  await expect(page.getByText(`Adresa e luată. Liberă: ${o2!.slug}-2`)).toBeVisible();
  await use.click();
  await expect(page.getByTestId("details-slug")).toHaveValue(`${o2!.slug}-2`);
  await page.getByTestId("details-slug-from-name").click();
  await expect(page.getByTestId("details-slug")).toHaveValue(SLUG);
  const { data: still } = await admin().from("properties").select("slug").eq("id", secondId).single();
  expect(still!.slug).toBe(`${SLUG}-2`);
});

async function openUnitForm(page: Page) {
  await page.goto(`/dashboard/proprietati/${propId}?tab=unitati`);
  await page.getByTestId("unit-add").click();
  await expect(page.getByTestId("unit-form")).toBeVisible();
}

test("14 + 15: tipurile din enum; capacitate 0, preț negativ, „abc”, peste 21.000.000 lei, publicată fără preț -> mesaje", async ({ page }) => {
  await openUnitForm(page);
  const options = await page.getByTestId("unit-form-type").locator("option").evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value));
  expect(options).toEqual(["camera", "apartament", "garsoniera", "casuta"]);

  const priceMsg = "Scrie un preț între 0,01 și 21.000.000 lei, de exemplu 450,50.";
  await page.getByTestId("unit-form-name").fill("E2E Fără preț");
  await page.getByTestId("unit-form-published").check();
  await page.getByTestId("unit-submit").click();
  await expect(page.getByTestId("unit-form").getByText(priceMsg)).toBeVisible();

  for (const bad of ["-5", "abc", "21000000,01"]) {
    await page.getByTestId("unit-form-price").fill(bad);
    await page.getByTestId("unit-submit").click();
    await expect(page.getByTestId("unit-form").getByText(priceMsg)).toBeVisible();
  }
  await page.getByTestId("unit-form-price").fill("300");
  await page.getByTestId("unit-form-max-guests").fill("0");
  await page.getByTestId("unit-submit").click();
  await expect(page.getByText("Între 1 și 50 de oaspeți.")).toBeVisible();
  await expect(page.getByText(/violates|constraint|PGRST|23\d\d\d/)).toHaveCount(0);

  const { count } = await admin().from("units").select("id", { count: "exact", head: true }).eq("property_id", propId);
  expect(count).toBe(0);
});

test("2 + 15: unitate nouă cu „450,50” -> 45050 împreună; rând în grafic; cu rezervări nu se șterge", async ({ page }) => {
  await openUnitForm(page);
  await page.getByTestId("unit-form-name").fill("E2E Apartament");
  await page.getByTestId("unit-form-type").selectOption("apartament");
  await page.getByTestId("unit-form-price").fill("450,50");
  await page.getByTestId("unit-form-published").check();
  await page.getByTestId("unit-submit").click();
  const row = page.getByTestId("unit-row").filter({ hasText: "E2E Apartament" });
  await expect(row).toBeVisible();
  const unitId = (await row.getAttribute("data-unit-id"))!;
  await expect(row.getByTestId("unit-price")).toContainText("450,50");

  const db = admin();
  const { data: unit } = await db.from("units").select("type, is_published, position").eq("id", unitId).single();
  expect(unit).toEqual({ type: "apartament", is_published: true, position: 0 });
  const { data: prices } = await db.from("unit_prices").select("kind, price_per_night").eq("unit_id", unitId);
  expect(prices).toEqual([{ kind: "base", price_per_night: 45050 }]);

  await page.goto(`/dashboard?proprietate=${propId}`);
  await expect(page.locator(`[data-testid="chart-row"][data-unit-id="${unitId}"]`)).toBeVisible();

  await insertBooking({ org: await owner1Org(), unit: unitId, check_in: "2027-03-01", check_out: "2027-03-03", status: "confirmed", name: "Ștergere unitate" });
  await page.goto(`/dashboard/proprietati/${propId}?tab=unitati`);
  await row.getByTestId("unit-delete").click();
  await row.getByTestId("unit-delete-confirm").click();
  await expect(page.getByTestId("unit-delete-error")).toHaveText(
    "Unitatea are rezervări, așa că nu poate fi ștearsă. O poți ascunde: debifează „Publicată”.",
  );
  const { data: still } = await db.from("units").select("id").eq("id", unitId);
  expect(still).toHaveLength(1);
});

// Mouse drag (dnd-kit PointerSensor, 6 px to start): the row moves one place down.
async function moveDown(page: Page, handle: ReturnType<Page["getByTestId"]>) {
  const row = page.getByTestId("unit-row");
  const h = (await handle.boundingBox())!;
  const rowH = (await row.first().boundingBox())!.height;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + 10, { steps: 3 });
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + rowH + 12, { steps: 10 });
  await page.mouse.up();
}

test("3 + 16: ordinea unităților rămâne după reîncărcare, 0..n-1 și după două trageri rapide", async ({ page }) => {
  const org = await owner1Org();
  const prop = await insertProperty({ org, name: `Ordine ${tag}` });
  const ids = [];
  for (const [i, n] of ["A", "B", "C"].entries()) ids.push(await insertUnit({ org, property: prop, name: `E2E Unit ${n}`, position: i }));

  await page.goto(`/dashboard/proprietati/${prop}?tab=unitati`);
  await page.waitForLoadState("networkidle");
  const order = () => page.getByTestId("unit-row").evaluateAll((r) => r.map((x) => x.getAttribute("data-unit-id")));
  await expect.poll(order).toEqual(ids);

  // One drag: A below B.
  await moveDown(page, page.getByTestId("unit-row").first().getByTestId("unit-handle"));
  await expect(page.getByText("Ordinea e salvată.")).toBeVisible();
  await expect.poll(order).toEqual([ids[1], ids[0], ids[2]]);
  // Two quick drags, the second while the first save is in flight.
  await moveDown(page, page.getByTestId("unit-row").nth(0).getByTestId("unit-handle"));
  await page.waitForTimeout(400); // the drop animation (and the flicker reported below) settles
  await moveDown(page, page.getByTestId("unit-row").nth(1).getByTestId("unit-handle"));
  const expected = [ids[0], ids[2], ids[1]]; // [B,A,C] -> [A,B,C] -> [A,C,B]
  await expect.poll(order).toEqual(expected);
  await expect(page.getByText("Ordinea e salvată.")).toBeVisible();

  const positions = async () => {
    const { data } = await admin().from("units").select("id, position").eq("property_id", prop).order("position");
    return data!;
  };
  await expect.poll(async () => (await positions()).map((u) => u.id)).toEqual(expected);
  expect((await positions()).map((u) => u.position)).toEqual([0, 1, 2]);
  await page.reload();
  await expect.poll(order).toEqual(expected);
});

// Check 1 "(404)": the HTTP code itself, apart so the serial flow above keeps running when it fails.
test("1: owner2 pe URL-ul direct al proprietății lui owner1 primește HTTP 404", async ({ browser }) => {
  const org = await owner1Org();
  const prop = await insertProperty({ org, name: `404 ${tag}` });
  const ctx = await browser.newContext({ storageState: OWNER2_STATE });
  const res = await (await ctx.newPage()).goto(`/dashboard/proprietati/${prop}`);
  const status = res!.status();
  await ctx.close();
  expect(status).toBe(404);
});

// Brief 04 flow "Adaugă proprietate" -> Detalii: the new page must take clicks without a reload.
test("1: după „Adaugă proprietate”, pagina nouă primește clicuri (sheet-ul nu rămâne modal)", async ({ page }) => {
  await page.goto("/dashboard/proprietati");
  await page.getByTestId("property-add").click();
  await page.getByTestId("property-create-name").fill(`E2E Clic ${tag}`);
  await page.getByTestId("property-create-submit").click();
  await expect(page).toHaveURL(/\/dashboard\/proprietati\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("details-submit")).toBeVisible();
  await page.screenshot({ path: "docs/briefs/04-capturi/bug-dupa-creare-1440.png" });
  const modals = await page.evaluate(() => [...document.querySelectorAll("dialog")].filter((d) => d.matches(":modal")).map((d) => d.getAttribute("data-testid")));
  expect(modals, "modal dialogs left open after navigation").toEqual([]);
  await page.getByTestId("details-submit").click({ timeout: 5_000 });
  await expect(page.getByTestId("details-saved")).toBeVisible();
});

// Self-contained (last): a crash here must not stop the serial flow above.
test("14: lat/lng în afara intervalului primesc mesaj în română", async ({ page }) => {
  const id = await insertProperty({ org: await owner1Org(), name: `Coordonate ${tag}` });
  await page.goto(`/dashboard/proprietati/${id}`);
  await page.getByTestId("details-lat").fill("95");
  await page.getByTestId("details-lng").fill("25");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "docs/briefs/04-capturi/bug-lat-95-1440.png" });
  await page.getByTestId("details-submit").click();
  await expect(page.getByText("Pune ambele coordonate: latitudinea e între -90 și 90.")).toBeVisible();
  await page.getByTestId("details-lat").fill("45,6");
  await page.getByTestId("details-lng").fill("200");
  await page.getByTestId("details-submit").click();
  await expect(page.getByText("Longitudinea e între -180 și 180.")).toBeVisible();
  const { data } = await admin().from("properties").select("lat, lng").eq("id", id).single();
  expect(data).toEqual({ lat: null, lng: null });
});

// Check 16: after a drop the list keeps the new order; it must not jump back to the old one while
// the save is answered (a second quick drag would then grab the wrong row).
test("16: după tragere, lista nu revine nici pentru o clipă la ordinea veche", async ({ page }) => {
  const org = await owner1Org();
  const prop = await insertProperty({ org, name: `Clipire ${tag}` });
  const ids: string[] = [];
  for (const [i, n] of ["A", "B", "C"].entries()) ids.push(await insertUnit({ org, property: prop, name: `E2E Unit ${n}`, position: i }));
  await page.goto(`/dashboard/proprietati/${prop}?tab=unitati`);
  await page.waitForLoadState("networkidle");
  const order = () => page.getByTestId("unit-row").evaluateAll((r) => r.map((x) => x.getAttribute("data-unit-id")));
  await moveDown(page, page.getByTestId("unit-row").first().getByTestId("unit-handle"));
  const seen: string[] = [];
  for (let i = 0; i < 40; i++) {
    seen.push((await order()).map((x) => "ABC"[ids.indexOf(x!)]).join(""));
    await page.waitForTimeout(50);
  }
  await page.screenshot({ path: "docs/briefs/04-capturi/unitati-dupa-tragere-1440.png" });
  expect(seen.filter((o) => o !== "BAC"), `orders seen in 2 s after the drop: ${seen.join(" ")}`).toEqual([]);
});

test("13: ștergerea unei unități fără rezervări îi șterge pozele (rând + fișier); pozițiile rămân 0..n-1", async ({ page }) => {
  const org = await owner1Org();
  const prop = await insertProperty({ org, name: `Stergere ${tag}` });
  const ids = [];
  for (const [i, n] of ["A", "B", "C"].entries()) ids.push(await insertUnit({ org, property: prop, name: `E2E Unit ${n}`, position: i }));
  const p0 = await insertPhoto({ org, property: prop, position: 0, cover: true });
  const p1 = await insertPhoto({ org, property: prop, unit: ids[1], position: 1 });
  const p2 = await insertPhoto({ org, property: prop, position: 2 });
  const positions = async () => {
    const { data } = await admin().from("units").select("id, position").eq("property_id", prop).order("position");
    return data!;
  };
  await page.goto(`/dashboard/proprietati/${prop}?tab=unitati`);
  // Check 13: deleting B (no bookings) removes its photo row and file; photo positions stay 0..n-1.
  expect(await fileExists(p1.path)).toBe(true);
  const rowB = page.locator(`[data-testid="unit-row"][data-unit-id="${ids[1]}"]`);
  await rowB.getByTestId("unit-delete").click();
  await rowB.getByTestId("unit-delete-confirm").click();
  await expect(page.getByText("Unitatea a fost ștearsă.")).toBeVisible();
  await expect(rowB).toHaveCount(0);
  const db = admin();
  const { data: photos } = await db.from("photos").select("id, position, is_cover").eq("property_id", prop).order("position");
  expect(photos).toEqual([
    { id: p0.id, position: 0, is_cover: true },
    { id: p2.id, position: 1, is_cover: false },
  ]);
  expect(await fileExists(p1.path)).toBe(false);
  expect(await fileExists(p0.path)).toBe(true);
  expect((await positions()).map((u) => [u.id, u.position])).toEqual([
    [ids[0], 0],
    [ids[2], 1],
  ]);
});
