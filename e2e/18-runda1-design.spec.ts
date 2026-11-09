import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  AUTH_COOKIE,
  OWNER1_STATE,
  admin,
  encodeSessionCookie,
  noHorizontalScroll,
  passwordSession,
  sessionFromStateFile,
  setTheme,
  watchConsole,
} from "./support/helpers";
import { P, SEL, addDays, bucharestToday, chartRows, gotoChart } from "./support/chart";

// Brief 03 handover, round 1 (design block): blocked / iCal bookings show their source, not an empty
// guest; unit names are not cut on a phone; the phone opens on 7 days when `zile` is missing.
test.use({ storageState: OWNER1_STATE, locale: "ro-RO", timezoneId: "Europe/Bucharest" });

const SHOTS = path.join(process.cwd(), "docs", "briefs", "03-capturi");
const SOURCE = { booking: "Booking.com", airbnb: "Airbnb" } as const;

test("blocate din Booking.com / Airbnb: titlul arată sursa, fără oaspeți și sumă; eticheta barei nu e „Fără nume”", async ({ page }) => {
  const today = await bucharestToday();
  const from = addDays(today, -3);
  await gotoChart(page, from, 30);
  const { rows } = await chartRows(sessionFromStateFile(OWNER1_STATE).access_token, from, addDays(from, 30));
  for (const source of ["booking", "airbnb"] as const) {
    const row = rows.find((r) => r.status === "blocked" && r.source === source);
    expect(row, `seed has a blocked ${source} booking in the window`).toBeDefined();
    const bar = page.locator(`${SEL.bar}[data-booking-id="${row!.booking_id}"]`);
    await expect(bar).not.toHaveAttribute("aria-label", /Fără nume/);
    await expect(bar).toHaveAttribute("aria-label", new RegExp(SOURCE[source].replace(".", "\\.")));
    await bar.scrollIntoViewIfNeeded();
    await bar.click();
    const panel = page.locator(SEL.panel);
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("details-guest")).toHaveText(`Blocată · ${SOURCE[source]}`);
    await expect(panel).not.toContainText("Oaspeți");
    await expect(panel).not.toContainText("Sumă");
    await expect(panel).not.toContainText("Fără nume");
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  }
  // Booking.com and Airbnb bars do not share the same icon.
  const icon = (source: string) =>
    page.locator(`${SEL.bar}[data-source="${source}"] svg`).first().evaluate((s) => s.innerHTML);
  expect(await icon("booking")).not.toEqual(await icon("airbnb"));
});

test("390: numele unităților nu sunt tăiate; vederea implicită e de 7 zile", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setTheme(context, "light");
  const errors = watchConsole(page);
  const navigations: string[] = [];
  page.on("framenavigated", (f) => f === page.mainFrame() && navigations.push(f.url()));
  const documents: string[] = [];
  page.on("request", (r) => r.isNavigationRequest() && r.frame() === page.mainFrame() && documents.push(r.url()));
  const fiveXX: string[] = [];
  page.on("response", (r) => r.status() >= 500 && fiveXX.push(`${r.status()} ${r.url()}`));

  await page.goto("/dashboard");
  await expect(page.locator(SEL.chart)).toBeVisible();
  // No `zile` in the URL: the phone is sent to 7 days and the URL says so.
  await expect(page).toHaveURL(new RegExp(`${P.days}=7`));
  await expect(page.locator(SEL.chart)).toHaveAttribute("data-days", "7");
  await expect(page.locator(SEL.day)).toHaveCount(7);
  await page.waitForLoadState("networkidle");
  // The switch to 7 days: one document load, then at most one URL change (?zile=7); no 5xx, console clean.
  // Playwright also reports Next's own history.replaceState on hydration as a navigation to the same
  // URL (/dashboard twice, measured 8 Nov), so repeats of the same URL are folded before counting.
  const urlChanges = navigations.filter((u, i) => i === 0 || u !== navigations[i - 1]);
  expect(documents, `full document loads: ${documents.join(" | ")}`).toHaveLength(1);
  expect(urlChanges.length, `main-frame navigations while the phone switches to 7 days: ${navigations.join(" | ")}`).toBeLessThanOrEqual(2);
  expect(fiveXX, fiveXX.join("\n")).toEqual([]);
  expect(errors, errors.join("\n")).toEqual([]);
  await noHorizontalScroll(page);
  await page.locator(SEL.chart).evaluate((e) => e.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: path.join(SHOTS, "390-zi-7zile-implicit.png"), animations: "disabled" });

  const names = page.locator(`${SEL.row} [role="rowheader"] span`);
  expect(await names.count()).toBeGreaterThan(0);
  const cut = await names.evaluateAll((els) =>
    els
      .filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)
      .map((e) => e.textContent),
  );
  expect(cut, "unit names clipped at 390").toEqual([]);
  const size = await names.first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(size).toBeGreaterThanOrEqual(13);

  // An explicit `zile` still wins on the phone.
  await page.goto(`/dashboard?${P.days}=14`);
  await expect(page.locator(SEL.day)).toHaveCount(14);
});

test("starea goală: „Încă nu ai unități” cu link spre Proprietăți (cont e2e nou, fără unități)", async ({ browser }) => {
  // A fresh e2e+<ts> account (cleanup.teardown.ts deletes it). One password sign-in: 1 of the 30 / 5 min.
  const email = `e2e+${Date.now()}@example.com`;
  const password = `E2e-${Date.now()}-parola!`;
  const { error } = await admin().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Ioana Marin" } });
  expect(error).toBeNull();
  const session = await passwordSession(email, password);
  const value = encodeSessionCookie(session);
  const base = AUTH_COOKIE();
  const url = new URL(test.info().project.use.baseURL ?? "http://localhost:3100");
  const parts = value.length > 3180 ? (value.match(/.{1,3180}/g) ?? []).map((v, i) => ({ name: `${base}.${i}`, value: v })) : [{ name: base, value }];
  const ctx = await browser.newContext({ baseURL: url.origin, storageState: undefined, locale: "ro-RO", timezoneId: "Europe/Bucharest", viewport: { width: 390, height: 844 } });
  await ctx.addCookies(parts.map((p) => ({ ...p, domain: url.hostname, path: "/", sameSite: "Lax" as const })));
  await setTheme(ctx, "light");
  const page = await ctx.newPage();
  const errors = watchConsole(page);
  await page.goto("/dashboard");
  const empty = page.getByTestId("chart-empty");
  await expect(empty).toContainText("Încă nu ai unități.");
  const link = page.getByTestId("chart-empty-properties");
  await expect(link).toHaveAttribute("href", "/dashboard/proprietati");
  await expect(link).toContainText("Proprietăți");
  await noHorizontalScroll(page);
  await empty.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(SHOTS, "390-zi-gol-proprietati.png"), animations: "disabled" });
  await link.click();
  await expect(page).toHaveURL(/\/dashboard\/proprietati$/);
  expect(errors, errors.join("\n")).toEqual([]);
  await ctx.close();
});
