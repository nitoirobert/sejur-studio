import { expect, test, type Page } from "@playwright/test";
import { OWNER1_STATE, admin, watchConsole } from "./support/helpers";
import { addDays, bucharestToday } from "./support/chart";
import { anon, deleteE2EProperties, insertProperty, insertUnit, owner1Org, runTag } from "./support/props";

// Brief 04 check 5: seasons (date_to exclusive), same-priority overlap refused, one weekend rule,
// and the 30-day preview equal to public_quote night by night.
test.use({ storageState: OWNER1_STATE });
const tag = runTag();
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

async function setup(name: string, active = false) {
  const org = await owner1Org();
  const prop = await insertProperty({ org, name: `${name} ${tag}`, status: active ? "activa" : "ascunsa" });
  const unit = await insertUnit({ org, property: prop, name: "E2E Camera prețuri", published: active, price: 30000 });
  return { prop, unit };
}

async function addSeason(page: Page, first: string, last: string, price: string, priority: string) {
  await page.getByTestId("season-add").click();
  const form = page.getByTestId("season-form");
  await expect(form).toBeVisible();
  await form.getByTestId("season-first").fill(first);
  await form.getByTestId("season-last").fill(last);
  await form.getByTestId("season-price-input").fill(price);
  await form.getByTestId("season-min").fill("1");
  await form.getByTestId("season-priority").fill(priority);
  await form.getByTestId("season-submit").click();
}

const seasons = async (unit: string) => {
  const { data } = await admin()
    .from("unit_prices")
    .select("date_from, date_to, price_per_night, priority")
    .eq("unit_id", unit)
    .eq("kind", "season")
    .order("date_from");
  return data!;
};

test("5: sezonul 1–31 aug se salvează cu date_to = 1 sept; ultima noapte înaintea primei e refuzată", async ({ page }) => {
  const { prop, unit } = await setup("Sezon august");
  await page.goto(`/dashboard/proprietati/${prop}?tab=preturi&unitate=${unit}`);
  await page.waitForLoadState("networkidle");

  await addSeason(page, "2027-08-10", "2027-08-05", "500", "0");
  await expect(page.getByTestId("season-form").getByText("Ultima noapte e cel puțin prima, iar sezonul are cel mult 366 de nopți.")).toBeVisible();
  expect(await seasons(unit)).toEqual([]);
  await page.keyboard.press("Escape");

  await addSeason(page, "2027-08-01", "2027-08-31", "500", "0");
  await expect(page.getByTestId("season-row")).toHaveCount(1);
  expect(await seasons(unit)).toEqual([{ date_from: "2027-08-01", date_to: "2027-09-01", price_per_night: 50000, priority: 0 }]);
  // The screen shows the last night, inclusive.
  await expect(page.getByTestId("season-range")).toContainText("31");
  await expect(page.getByTestId("season-range")).not.toContainText("1 sept");
});

test("5: două sezoane suprapuse cu aceeași prioritate -> refuz cu mesaj; cu prioritate mai mare -> salvat; un singur weekend", async ({ page }) => {
  const { prop, unit } = await setup("Sezon suprapus");
  await page.goto(`/dashboard/proprietati/${prop}?tab=preturi&unitate=${unit}`);
  await page.waitForLoadState("networkidle");
  await addSeason(page, "2027-07-01", "2027-07-20", "500", "0");
  await expect(page.getByTestId("season-row")).toHaveCount(1);

  await addSeason(page, "2027-07-20", "2027-07-25", "800", "0");
  await expect(page.getByTestId("season-form-error")).toHaveText(
    "Alt sezon cu aceeași prioritate acoperă deja o noapte din interval. Schimbă datele sau prioritatea.",
  );
  expect(await seasons(unit)).toHaveLength(1);
  await page.getByTestId("season-priority").fill("5");
  await page.getByTestId("season-submit").click();
  await expect(page.getByTestId("season-row")).toHaveCount(2);
  // Touching but not overlapping (date_to exclusive) with the same priority is allowed.
  await addSeason(page, "2027-07-21", "2027-07-22", "600", "0");
  await expect(page.getByTestId("season-row")).toHaveCount(3);

  for (const price of ["400", "450"]) {
    if (await page.getByTestId("price-weekend-add").isVisible()) await page.getByTestId("price-weekend-add").click();
    await page.getByTestId("price-weekend-price").fill(price);
    await page.getByTestId("price-weekend-save").click();
    const want = Number(price) * 100;
    await expect
      .poll(async () => (await admin().from("unit_prices").select("price_per_night").eq("unit_id", unit).eq("kind", "weekend")).data)
      .toEqual([{ price_per_night: want }]);
    await expect(page.getByTestId("price-weekend-delete")).toBeVisible();
    await page.waitForLoadState("networkidle");
  }
  // Saving the weekend price twice updates the one rule; it never adds a second.
});

test("5: previzualizarea pe 30 de zile = public_quote, noapte cu noapte (sezon, weekend, bază)", async ({ page }) => {
  const { prop, unit } = await setup("Previzualizare", true);
  const today = await bucharestToday();
  await page.goto(`/dashboard/proprietati/${prop}?tab=preturi&unitate=${unit}`);
  await page.waitForLoadState("networkidle");
  await addSeason(page, addDays(today, 3), addDays(today, 12), "500", "0");
  await expect(page.getByTestId("season-row")).toHaveCount(1);
  await addSeason(page, addDays(today, 5), addDays(today, 6), "800,25", "5");
  await expect(page.getByTestId("season-row")).toHaveCount(2);
  await page.getByTestId("price-weekend-add").click();
  await page.getByTestId("price-weekend-price").fill("400");
  await page.getByTestId("price-weekend-save").click();
  await expect(page.getByTestId("price-weekend-delete")).toBeVisible();

  const nights = page.getByTestId("price-preview-night");
  await expect(nights).toHaveCount(30);
  const shown = await nights.evaluateAll((n) =>
    n.map((x) => ({ night: x.getAttribute("data-night"), kind: x.getAttribute("data-kind"), price: Number(x.getAttribute("data-price")) })),
  );
  expect(shown[0].night).toBe(today);
  const kinds = new Set(shown.map((s) => s.kind));
  expect([...kinds].sort()).toEqual(["base", "season", "weekend"]);

  const { data, error } = await anon().rpc("public_quote", {
    p_unit_id: unit,
    p_check_in: today,
    p_check_out: addDays(today, 30),
    p_adults: 1,
    p_children: 0,
  });
  expect(error).toBeNull();
  const quote = (data as { nights: number; total: number; nightly: unknown; ok: boolean; reason: string | null }[])[0];
  test.info().annotations.push({ type: "public_quote", description: JSON.stringify(quote).slice(0, 400) });
  expect(quote.nights).toBe(30);
  // nightly is {"YYYY-MM-DD": bani}.
  const fromDb = Object.entries(quote.nightly as Record<string, number>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([night, price]) => ({ night, price: Number(price) }));
  expect(fromDb).toEqual(shown.map((s) => ({ night: s.night, price: s.price })));
  expect(Number(quote.total)).toBe(shown.reduce((a, s) => a + s.price, 0));
  await page.getByTestId("price-preview").screenshot({ path: "docs/briefs/04-capturi/preturi-previzualizare-1440.png" });
});
