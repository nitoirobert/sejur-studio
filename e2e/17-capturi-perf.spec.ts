import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { OWNER1_STATE, noCedilla, noHorizontalScroll, setTheme, watchConsole } from "./support/helpers";
import { OWNER1_UNITS, SEL, expectError, addDays, bucharestToday, cell, fillForm, freeRange, gotoChart, submitButton } from "./support/chart";

// Brief 03, checks 8 and 15: captures (1440 / 768 / 390, day and night), page without horizontal
// scroll, console clean, render timings in the production build, request count per navigation.
const SHOTS = path.join(process.cwd(), "docs", "briefs", "03-capturi");
test.use({ storageState: OWNER1_STATE, locale: "ro-RO", timezoneId: "Europe/Bucharest" });
test.beforeAll(() => fs.mkdirSync(SHOTS, { recursive: true }));

const WIDTHS = [
  { w: 1440, h: 900 },
  { w: 768, h: 1024 },
  { w: 390, h: 844 },
];

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), animations: "disabled" });
}

for (const { w, h } of WIDTHS) {
  for (const theme of ["light", "dark"] as const) {
    test(`8: ${w}px ${theme === "light" ? "zi" : "noapte"}: grafic, selecție, formular, eroare, panou`, async ({ page, context }) => {
      await page.setViewportSize({ width: w, height: h });
      await setTheme(context, theme);
      const errors = watchConsole(page);
      const tag = `${w}-${theme === "light" ? "zi" : "noapte"}`;
      const today = await bucharestToday();
      const unit = OWNER1_UNITS[4];
      const start = await freeRange(unit, addDays(today, 1), 2);
      await gotoChart(page, today, 30);
      await noHorizontalScroll(page);
      await noCedilla(page);
      // Scroll is inside the chart only, and the unit column stays put while it scrolls.
      const sc = page.locator(SEL.scroller);
      const { sw, cw } = await sc.evaluate((e) => ({ sw: e.scrollWidth, cw: e.clientWidth }));
      if (w === 390) expect(sw, "chart scrolls inside").toBeGreaterThan(cw);
      const firstRowLabel = page.locator(`${SEL.row}[data-unit-id="${OWNER1_UNITS[0]}"] [role="rowheader"]`);
      const x0 = (await firstRowLabel.boundingBox())?.x;
      expect(x0, "unit column label has a box").toBeDefined();
      await sc.evaluate((e) => (e.scrollLeft = 400));
      expect((await firstRowLabel.boundingBox())?.x).toBeCloseTo(x0!, 0);
      await sc.evaluate((e) => (e.scrollLeft = 0));
      await page.locator(SEL.chart).evaluate((e) => e.scrollIntoView({ block: "start" }));
      await shot(page, `${tag}-1-grafic`);

      // Mid-drag selection.
      const a = cell(page, unit, start);
      await a.scrollIntoViewIfNeeded();
      const ba = (await a.boundingBox())!;
      const bb = (await cell(page, unit, addDays(start, 1)).boundingBox())!;
      await page.mouse.move(ba.x + ba.width / 2, ba.y + ba.height / 2);
      await page.mouse.down();
      await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 6 });
      await shot(page, `${tag}-2-selectie`);
      await page.mouse.up();

      await expect(page.locator(SEL.form)).toBeVisible();
      if (w === 390) {
        const fb = (await page.locator(SEL.sheet).boundingBox())!;
        expect(fb.y + fb.height, "bottom sheet sits on the bottom edge").toBeGreaterThan(h - 4);
      }
      // Realistic guest for the captures; nothing is saved (the next step is a refused amount).
      await fillForm(page, { name: "Ioana Marin", email: "ioana.marin@example.ro", phone: "+40 722 123 456", adults: "2", children: "1", amount: "450,50" });
      await shot(page, `${tag}-3-formular`);

      await fillForm(page, { amount: "abc" });
      await submitButton(page).click();
      await expectError(page, "invalid_amount");
      await shot(page, `${tag}-4-eroare`);
      await page.keyboard.press("Escape");
      await expect(page.locator(SEL.form)).toBeHidden();

      const bar = page.locator(SEL.bar).first();
      await bar.scrollIntoViewIfNeeded();
      await bar.click();
      await expect(page.locator(SEL.panel)).toBeVisible();
      await noHorizontalScroll(page);
      await shot(page, `${tag}-5-panou`);
      await page.keyboard.press("Escape");
      expect(errors, errors.join("\n")).toEqual([]);
    });
  }
}

test("8 + 15: 30 zile × 6 unități: mediana a 5 montări < 100 ms (build de producție)", async ({ page }) => {
  const today = await bucharestToday();
  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    await gotoChart(page, today, 30);
    await expect(page.locator(SEL.row)).toHaveCount(6);
    const t = await page.evaluate(() => {
      const m = performance.getEntriesByType("measure").filter((e) => e.name === "booking-chart-render");
      return m.length ? m[m.length - 1].duration : null;
    });
    expect(t, "chart exposes a performance.measure with 'chart' in its name").not.toBeNull();
    times.push(t!);
  }
  times.sort((a, b) => a - b);
  console.log(`chart mount ms: ${times.map((t) => t.toFixed(1)).join(", ")}`);
  expect(times[2]).toBeLessThan(100);
});

test("15: tragerea de 2 secunde fără long task-uri > 50 ms", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __long: number[] };
    w.__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__long.push(e.duration))).observe({ type: "longtask", buffered: false });
  });
  const today = await bucharestToday();
  const unit = OWNER1_UNITS[4];
  const start = await freeRange(unit, addDays(today, 1), 8);
  await gotoChart(page, today, 30);
  await page.waitForTimeout(1000);
  await page.evaluate(() => ((window as unknown as { __long: number[] }).__long = []));
  const a = (await cell(page, unit, start).boundingBox())!;
  const b = (await cell(page, unit, addDays(start, 7)).boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  const steps = 40;
  for (let i = 1; i <= steps; i++) {
    const x = a.x + a.width / 2 + ((b.x - a.x) * i) / steps;
    await page.mouse.move(x, a.y + a.height / 2);
    await page.waitForTimeout(50);
  }
  const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
  await page.mouse.up();
  await page.keyboard.press("Escape");
  expect(long, `long tasks during drag: ${long.join(", ")}`).toEqual([]);
});

test("15: fiecare navigare = o singură cerere de date (fără cereri duble)", async ({ page }) => {
  const today = await bucharestToday();
  await gotoChart(page, today, 7);
  const seen: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (/dashboard_chart|\/rest\/v1\/units/.test(u) || r.headers()["rsc"] || r.headers()["next-action"]) seen.push(`${r.method()} ${u}`);
  });
  await page.locator(SEL.next).click();
  await expect(page).toHaveURL(new RegExp(`de=${addDays(today, 7)}`));
  await page.waitForLoadState("networkidle");
  // Browser side: one RSC/data request per navigation and no direct Supabase calls from the client.
  expect(seen.filter((s) => /dashboard_chart|\/rest\/v1\/units/.test(s))).toEqual([]);
  expect(seen.length, seen.join("\n")).toBe(1);
  // Server side (1 dashboard_chart + 1 units query per navigation): NOT asserted here. The server
  // talks to Supabase from Node, out of the browser's sight, and the app exposes no counter. It is
  // checked by reading src/components/dashboard/chart/load.ts (one units query + one rpc call).
  test.info().annotations.push({ type: "not verified", description: "server-side query count is not measurable from Playwright; see load.ts" });
});

