import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { OWNER1_STATE, admin, asUser, axeAA, noCedilla, noHorizontalScroll, watchConsole } from "./support/helpers";
import { anon, runTag } from "./support/props";
import { GUEST_STATE, axeList, createGuest, freeStay, openUnit, pricedUnits, requestViaUi, signInContext, useIp } from "./support/guest";

// Brief 07, checks 3, 4, 11, 23: the guest account (/cont/rezervari, /cont/favorite, the heart).
// Two guest accounts, created with the admin key and signed in once each (auth limit 30 / 5 min).
const SHOTS = path.join(process.cwd(), "docs", "briefs", "07-capturi");
const TAG = runTag();
const A = { email: `e2e+guest-a${TAG}@example.com`, name: `E2E Oaspete A ${TAG}` };
const B = { email: `e2e+guest-b${TAG}@example.com`, name: `E2E Oaspete B ${TAG}` };
type Guest = Awaited<ReturnType<typeof createGuest>>;
let ga: Guest;
let gb: Guest;
let UNIT = "";
let UNIT_NAME = "";
let TOKEN = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ga = await createGuest(A.email, A.name);
  gb = await createGuest(B.email, B.name);
  UNIT = (await pricedUnits())[0].id;
  const { data } = await admin().from("units").select("name").eq("id", UNIT).single();
  UNIT_NAME = data!.name as string;
});

async function as(context: BrowserContext, baseURL: string, g: Guest) {
  await signInContext(context, baseURL, g.session);
}
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOTS, name) });

test("3 + 11: cererea oaspetelui A apare în /cont/rezervari la 390 și 1440; B nu o vede; anon nu citește", async ({ page, context, baseURL }) => {
  const errors = watchConsole(page);
  await as(context, baseURL!, ga);
  await useIp(page);
  const stay = await freeStay(UNIT, 70);
  // A sends with B's email: linked to A only (auth.uid(), never by email).
  TOKEN = await requestViaUi(page, UNIT, stay, { name: A.name, email: B.email });
  const { data: row } = await admin().from("bookings").select("user_id").eq("public_token", TOKEN).single();
  expect(row!.user_id).toBe(ga.id);

  for (const vp of [
    { w: 390, h: 844 },
    { w: 1440, h: 900 },
  ]) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.goto("/cont/rezervari");
    const item = page.getByTestId("my-booking").filter({ hasText: UNIT_NAME });
    await expect(item.first()).toBeVisible();
    await expect(item.first()).toContainText("În așteptare");
    await noCedilla(page);
    if (vp.w === 390) await noHorizontalScroll(page);
    await shot(page, `cont-rezervari-${vp.w}.png`);
    expect.soft(axeList(await axeAA(page)), `axe /cont/rezervari ${vp.w}`).toEqual([]);
  }
  expect(errors).toEqual([]);

  // B (the email owner) does not see it; anon cannot call my_bookings nor read bookings.
  const { data: mineB } = await asUser(gb.session.access_token).rpc("my_bookings");
  expect((mineB ?? []).map((r: { public_token: string }) => r.public_token)).not.toContain(TOKEN);
  const { error: anonErr } = await anon().rpc("my_bookings");
  expect(anonErr?.code).toBe("42501");
  const { data: anonRows } = await anon().from("bookings").select("id").eq("public_token", TOKEN);
  expect(anonRows ?? []).toEqual([]);
});

test("4: inima fără cont deschide fereastra de intrare; cu cont rămâne după reîncărcare, card = pagină; clic dublu = un rând", async ({ page, browser, context, baseURL }) => {
  // Without an account.
  const anonCtx = await browser.newContext({ baseURL, storageState: GUEST_STATE });
  const ap = await anonCtx.newPage();
  await ap.goto(`/cazare/${UNIT}`);
  await ap.getByRole("button", { name: `Adaugă la favorite: ${UNIT_NAME}` }).first().click();
  await expect(ap.getByText("Salvează-ți favoritele")).toBeVisible();
  await shot(ap, "favorite-fara-cont-1440.png");
  await anonCtx.close();

  const errors = watchConsole(page);
  await as(context, baseURL!, ga);
  await openUnit(page, UNIT);
  const heart = page.getByRole("button", { name: `Adaugă la favorite: ${UNIT_NAME}` }).first();
  await page.waitForLoadState("networkidle");
  await heart.dblclick();
  await page.waitForTimeout(1500);
  const rows = async () =>
    (await admin().from("favorites").select("id").eq("user_id", ga.id).eq("unit_id", UNIT)).data ?? [];
  // A fast double click toggles on then off, or stays on: never two rows, heart matches the DB.
  const after = await rows();
  expect(after.length).toBeLessThanOrEqual(1);
  if (after.length === 0) await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await rows()).length).toBe(1);

  await page.reload();
  await expect(heart).toHaveAttribute("aria-pressed", "true");
  // Same state on the card of the search page.
  await page.goto("/");
  const cardHeart = page.getByRole("button", { name: `Adaugă la favorite: ${UNIT_NAME}` }).first();
  await expect(cardHeart).toHaveAttribute("aria-pressed", "true");

  for (const vp of [
    { w: 390, h: 844 },
    { w: 1440, h: 900 },
  ]) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.goto("/cont/favorite");
    await expect(page.getByTestId("favorite").filter({ hasText: UNIT_NAME })).toBeVisible();
    if (vp.w === 390) await noHorizontalScroll(page);
    await shot(page, `cont-favorite-${vp.w}.png`);
    expect.soft(axeList(await axeAA(page)), `axe /cont/favorite ${vp.w}`).toEqual([]);
  }

  // Remove from the card, still removed after reload, on the unit page too.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(cardHeart).toHaveAttribute("aria-pressed", "true");
  const del = page.waitForResponse((r) => r.url().includes("/rest/v1/favorites") && r.request().method() === "DELETE", { timeout: 10_000 });
  await cardHeart.click();
  expect((await del).status(), "DELETE favorites from the card").toBeLessThan(300);
  await expect(cardHeart).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await rows()).length).toBe(0);
  await openUnit(page, UNIT);
  await expect(heart).toHaveAttribute("aria-pressed", "false");
  // Known race (reported): a click before the favorites store has loaded opens the sign-in window.
  await page.waitForLoadState("networkidle");
  await heart.click(); // left on: the teardown checks the cascade on account deletion
  await expect.poll(async () => (await rows()).length).toBe(1);
  expect(errors).toEqual([]);
});

test("23: oaspetele pe /dashboard/rezervari -> /; confirm_booking ca oaspete -> booking_not_found; /cont fără cont -> login", async ({ page, browser, context, baseURL }) => {
  await as(context, baseURL!, ga);
  await page.goto("/dashboard/rezervari");
  await expect(page).toHaveURL(new URL("/", baseURL).href);
  const { data: b } = await admin().from("bookings").select("id").eq("public_token", TOKEN).single();
  const { error } = await asUser(ga.session.access_token).rpc("confirm_booking", { p_booking_id: b!.id });
  expect(error?.message).toBe("booking_not_found");

  const anonCtx = await browser.newContext({ baseURL, storageState: GUEST_STATE });
  const ap = await anonCtx.newPage();
  await ap.goto("/cont/rezervari");
  await expect(ap).toHaveURL(/\/login\?next=%2Fcont%2Frezervari/);
  await anonCtx.close();

  // A host (owner1) can open /cont/rezervari too.
  const host = await browser.newContext({ baseURL, storageState: OWNER1_STATE });
  const hp = await host.newPage();
  const res = await hp.goto("/cont/rezervari");
  expect(res!.status()).toBeLessThan(400);
  await expect(hp).toHaveURL(/\/cont\/rezervari/);
  await host.close();
});
