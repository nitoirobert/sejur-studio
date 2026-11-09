import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { admin, axeAA, noCedilla, noHorizontalScroll, watchConsole } from "./support/helpers";
import { addDays, bucharestToday } from "./support/chart";
import { runTag } from "./support/props";
import {
  GUEST_STATE,
  axeList,
  bookingByToken,
  card,
  cardError,
  cleanRo,
  continueBtn,
  fillContact,
  freeStay,
  openUnit,
  pricedUnits,
  quote,
  requestViaUi,
  resetRateLimit,
  sendBtn,
  setStay,
  useIp,
} from "./support/guest";

// Brief 07, checks 1, 2, 7, 19, 20, 24, 26: the public booking request on /cazare/[id].
const SHOTS = path.join(process.cwd(), "docs", "briefs", "07-capturi");
const TAG = runTag();
const ro = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", "ro.json"), "utf8"));
const ERR = ro.BookingRequest.errors as Record<string, string>;

let UNIT = "";
let MAX = 2;

test.beforeAll(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const reset = await resetRateLimit();
  if (reset) test.info().annotations.push({ type: "rate-limit reset", description: reset });
  const units = await pricedUnits();
  expect(units.length, "a published, priced owner1 seed unit").toBeGreaterThan(0);
  ({ id: UNIT, max: MAX } = units[0]);
});

const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOTS, name), fullPage: false });

for (const vp of [
  { w: 390, h: 844 },
  { w: 1440, h: 900 },
]) {
  test(`1 + 7 + 19: oaspete fără cont la ${vp.w}: preț = public_quote, trimite, „În așteptare”; alt oaspete vede zilele ocupate`, async ({ page, browser, baseURL }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await useIp(page);
    const errors = watchConsole(page);
    const stay = await freeStay(UNIT, 30 + (vp.w === 390 ? 0 : 10));
    const q = await quote(UNIT, stay.from, stay.to, Math.min(2, MAX));
    expect(q.ok).toBe(true);

    await openUnit(page, UNIT);
    await setStay(page, stay.from, stay.to);
    const nightly = card(page).getByTestId("nightly").locator("li");
    await expect(nightly).toHaveCount(q.nights);
    const fmt = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });
    const amounts = Object.keys(q.nightly).sort().map((d) => q.nightly[d]);
    for (let i = 0; i < amounts.length; i++) await expect(nightly.nth(i)).toContainText(fmt.format(amounts[i] / 100));
    await expect(card(page).getByTestId("quote-total")).toContainText(fmt.format(q.total / 100));
    if (vp.w === 390) await noHorizontalScroll(page);
    await card(page).scrollIntoViewIfNeeded();
    await shot(page, `pret-${vp.w}.png`);

    // axe on /cazare/[id] with the form open (contact step).
    await continueBtn(page).click();
    await fillContact(page, { name: `E2E Oaspete ${TAG}-${vp.w}`, email: `e2e+g${TAG}${vp.w}@example.com` });
    await expect(sendBtn(page)).toBeVisible();
    await expect(sendBtn(page)).toBeInViewport({ ratio: 0.5 }).catch(async () => {
      await sendBtn(page).scrollIntoViewIfNeeded();
      await expect(sendBtn(page)).toBeInViewport();
    });
    if (vp.w === 390) await noHorizontalScroll(page);
    await shot(page, `formular-${vp.w}.png`);
    const axeForm = await axeAA(page);
    expect.soft(axeList(axeForm), "axe /cazare form").toEqual([]);

    await sendBtn(page).click();
    await page.waitForURL(/\/rezervare\/[0-9a-f-]{36}$/);
    const token = page.url().split("/").pop()!;
    await expect(page.getByText("În așteptare")).toBeVisible();
    const body = await page.locator("main").innerText();
    expect(body).not.toContain(`e2e+g${TAG}`);
    expect(body).not.toContain("712 345");
    expect(body).not.toContain(`E2E Oaspete`);
    await noCedilla(page);
    if (vp.w === 390) await noHorizontalScroll(page);
    await shot(page, `stare-asteptare-${vp.w}.png`);
    const axeStatus = await axeAA(page);
    expect.soft(axeList(axeStatus), "axe /rezervare").toEqual([]);

    // Check 7: the total comes from public_quote, not from the browser.
    const b = await bookingByToken(token);
    expect(b.status).toBe("hold");
    expect(Number(b.total_amount)).toBe(Number(q.total));
    expect(b.user_id).toBeNull();

    // Check 19: headers + title without the token.
    const res = await page.request.get(`/rezervare/${token}`);
    const h = res.headers();
    expect(h["referrer-policy"]).toBe("no-referrer");
    expect(h["cache-control"] ?? "").toContain("no-store");
    expect((h["x-robots-tag"] ?? "") + (await page.locator('meta[name="robots"]').getAttribute("content"))).toMatch(/noindex/);
    expect(await page.title()).not.toContain(token);

    // Another guest (fresh context, no cookies): same dates are busy, sending is refused.
    const other = await browser.newContext({ baseURL, storageState: GUEST_STATE, viewport: { width: vp.w, height: vp.h } });
    const p2 = await other.newPage();
    await useIp(p2);
    await openUnit(p2, UNIT);
    await setStay(p2, stay.from, stay.to);
    await expect(cardError(p2)).toHaveText(ERR.unavailable);
    await expect(continueBtn(p2)).toBeDisabled();
    await expect(card(p2).getByTestId("busy-days")).toBeVisible();
    cleanRo(await cardError(p2).innerText());
    await shot(p2, `eroare-ocupat-${vp.w}.png`);
    await other.close();

    // Wrong / malformed token: the same "not found" page, never a 500.
    for (const bad of ["00000000-0000-4000-8000-000000000000", "nu-e-uuid", "%27%20or%201=1"]) {
      const r = await page.goto(`/rezervare/${bad}`);
      expect(r!.status(), bad).toBeLessThan(500);
      await expect(page.getByRole("heading", { name: "Rezervare negăsită" })).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}

test("2 + 24: erorile din UI (persoane, email, date, prea multe cereri) și limita pe IP au mesaje românești", async ({ page }) => {
  test.setTimeout(150_000);
  await useIp(page);
  const errors = watchConsole(page);
  const email = `e2e+lim${TAG}@example.com`;

  // too_many_guests: the database answer for adults above max_guests (the stepper stops at max).
  const over = await quote(UNIT, ...(Object.values(await freeStay(UNIT, 120)) as [string, string]), MAX + 1);
  expect(over.reason).toBe("too_many_guests");

  // invalid_dates from the UI: check-out before check-in.
  const s0 = await freeStay(UNIT, 40);
  await openUnit(page, UNIT);
  await setStay(page, s0.from, s0.from);
  await card(page).locator('input[name="checkOut"]').fill(addDays(s0.from, -1));
  await expect(cardError(page)).toHaveText(ERR.invalid_dates);
  cleanRo(await cardError(page).innerText());
  await shot(page, "eroare-date-1440.png");

  // invalid_guest from the UI: wrong email.
  await setStay(page, s0.from, s0.to);
  await continueBtn(page).click();
  await fillContact(page, { name: `E2E Oaspete ${TAG}`, email: "nu-e-email" });
  await sendBtn(page).click();
  await expect(cardError(page)).toHaveText(ERR.invalid_guest);
  cleanRo(await cardError(page).innerText());

  // too_many_requests: 3 holds on the same email over 3 free ranges, the 4th is refused.
  for (let i = 0; i < 3; i++) {
    const s = await freeStay(UNIT, 150 + i * 6);
    await requestViaUi(page, UNIT, s, { name: `E2E Oaspete ${TAG} L${i}`, email });
  }
  const s4 = await freeStay(UNIT, 175);
  await openUnit(page, UNIT);
  await setStay(page, s4.from, s4.to);
  await continueBtn(page).click();
  await fillContact(page, { name: `E2E Oaspete ${TAG} L4`, email });
  await sendBtn(page).click();
  await expect(cardError(page)).toHaveText(ERR.too_many_requests);
  cleanRo(await cardError(page).innerText());
  await shot(page, "eroare-prea-multe-1440.png");

  // IP limit (default 5 / hour, counted before the database call): 4 hits so far, the 5th is
  // still allowed (too_many_requests again), the 6th gets the Romanian rate-limit message.
  await sendBtn(page).click();
  await expect(cardError(page)).toHaveText(ERR.too_many_requests);
  await sendBtn(page).click();
  await expect(cardError(page)).toHaveText(ERR.rate_limited);
  cleanRo(await cardError(page).innerText());
  await shot(page, "eroare-limita-ip-1440.png");

  // Every code has a Romanian message without the code, with comma-below letters.
  for (const code of ["unavailable", "too_many_guests", "invalid_guest", "too_many_requests", "invalid_dates", "unit_not_found", "min_nights", "no_price", "invalid_amount", "rate_limited", "generic"]) {
    expect(ERR[code], code).toBeTruthy();
    cleanRo(ERR[code]);
  }
  expect(errors).toEqual([]);
});

test("7 + 18 + 20: prețul trimis din browser e refuzat; clic dublu pe „Trimite” = o singură rezervare", async ({ page }) => {
  await useIp(page);
  const s = await freeStay(UNIT, 60);
  const q = await quote(UNIT, s.from, s.to, Math.min(2, MAX));

  // A tampered server-action body with an extra total field: strict schema -> refused, nothing written.
  await openUnit(page, UNIT);
  await setStay(page, s.from, s.to);
  await continueBtn(page).click();
  await fillContact(page, { name: `E2E Oaspete ${TAG} P`, email: `e2e+p${TAG}@example.com` });
  let tampered = false;
  await page.route("**/cazare/**", async (route) => {
    const req = route.request();
    const body = req.postData();
    if (req.method() === "POST" && body && body.includes("fullName") && !tampered) {
      tampered = true;
      return route.continue({ postData: body.replace(/"fullName"/, '"total":1,"price":1,"fullName"') });
    }
    return route.continue();
  });
  await sendBtn(page).click();
  await expect(cardError(page)).toHaveText(ERR.invalid_request);
  expect(tampered).toBe(true);
  const { data: none } = await admin().from("bookings").select("id, guests!inner(email)").eq("guests.email", `e2e+p${TAG}@example.com`);
  expect(none).toEqual([]);
  await page.unroute("**/cazare/**");

  // Double click on "Trimite cererea": one booking, total from public_quote.
  await sendBtn(page).dblclick();
  await page.waitForURL(/\/rezervare\/[0-9a-f-]{36}$/);
  const { data: rows } = await admin()
    .from("bookings")
    .select("id, total_amount, guests!inner(email)")
    .eq("guests.email", `e2e+p${TAG}@example.com`);
  expect(rows).toHaveLength(1);
  expect(Number(rows![0].total_amount)).toBe(Number(q.total));
});

test.describe("26: fus orar", () => {
  test.use({ timezoneId: "America/New_York" });
  test("26: în America/New_York „azi” pe formular e ziua din Europe/Bucharest", async ({ page }) => {
    await useIp(page);
    await openUnit(page, UNIT);
    const today = await bucharestToday();
    await expect(card(page).locator('input[name="checkIn"]')).toHaveAttribute("min", today);
  });
});
