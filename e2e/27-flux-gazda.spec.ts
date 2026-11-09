import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { OWNER1_STATE, OWNER2_STATE, admin, asUser, axeAA, noHorizontalScroll, sessionFromStateFile, watchConsole } from "./support/helpers";
import { anon, makeJpeg, runTag } from "./support/props";
import { addDays, bucharestToday } from "./support/chart";
import { GUEST_STATE, PHONE, axeList, freeStay, pricedUnits, requestViaUi, useIp } from "./support/guest";

// Brief 07, checks 5, 6, 21, 22: the host side of a booking request.
const SHOTS = path.join(process.cwd(), "docs", "briefs", "07-capturi");
const TAG = runTag();
let UNIT = "";
let seq = 0;

test.beforeAll(async () => {
  UNIT = (await pricedUnits())[0].id;
});

// A request as an anonymous guest straight through the RPC (the UI path is covered by 25-*).
async function request(unit = UNIT, offset = 90) {
  const s = await freeStay(unit, offset + seq * 4);
  const n = seq++;
  const { data, error } = await anon()
    .rpc("create_public_booking", {
      p_unit_id: unit,
      p_check_in: s.from,
      p_check_out: s.to,
      p_full_name: `E2E Cerere ${TAG}-${n}`,
      p_email: `e2e+req${TAG}-${n}@example.com`,
      p_phone: PHONE,
      p_adults: 1,
      p_children: 0,
    })
    .single();
  if (error) throw error;
  return data as { booking_id: string; public_token: string; hold_expires_at: string };
}

const badge = async (page: Page) => {
  const b = page.getByTestId("pending-badge").first();
  return (await b.count()) ? Number(await b.getAttribute("data-count")) : 0;
};
const row = (page: Page, id: string) => page.locator(`[data-testid="request-row"][data-booking-id="${id}"]`);
const status = async (page: Page, token: string) => {
  await page.goto(`/rezervare/${token}`);
  return page.locator("main");
};

test.describe("5 + 21 + 22: cererile în panou", () => {
  test.use({ storageState: OWNER1_STATE });

  test("5 + 22: insigna N -> N+1 -> N; Confirmă (clic dublu) și Refuză; pagina de stare a oaspetelui urmează", async ({ page, browser, baseURL }) => {
    const errors = watchConsole(page);
    await page.goto("/dashboard/rezervari");
    await expect(page.getByTestId("requests")).toBeVisible();
    const listTotal = Number(await page.getByTestId("requests-total").getAttribute("data-count"));
    // The badge loads on the client: wait for it, then it equals the list.
    await expect.poll(() => badge(page), { message: "insigna = lista" }).toBe(listTotal);
    const n = listTotal;

    const a = await request();
    const d = await request();
    await page.reload();
    await expect.poll(() => badge(page)).toBe(n + 2);
    await expect(row(page, a.booking_id)).toBeVisible();
    // No public token in the panel.
    expect(await page.content()).not.toContain(a.public_token);
    await page.screenshot({ path: path.join(SHOTS, "panou-insigna-1440.png") });
    expect.soft(axeList(await axeAA(page)), "axe /dashboard/rezervari 1440").toEqual([]);

    const confirm = row(page, a.booking_id).getByTestId("request-confirm");
    await confirm.dblclick();
    await expect.poll(() => badge(page), { message: "badge drops without reload" }).toBe(n + 1);
    const { data: ba } = await admin().from("bookings").select("status, hold_expires_at").eq("id", a.booking_id).single();
    expect(ba).toEqual({ status: "confirmed", hold_expires_at: null });

    await row(page, d.booking_id).getByTestId("request-decline").click();
    await expect.poll(() => badge(page)).toBe(n);
    const { data: bd } = await admin().from("bookings").select("status").eq("id", d.booking_id).single();
    expect(bd!.status).toBe("cancelled");
    expect(errors).toEqual([]);

    // The guest's status page follows; the confirmed booking is a bar in the chart.
    const g = await browser.newContext({ baseURL, storageState: GUEST_STATE });
    const gp = await g.newPage();
    await expect(await status(gp, a.public_token)).toContainText("Confirmată");
    await gp.screenshot({ path: path.join(SHOTS, "stare-confirmata-1440.png") });
    await expect(await status(gp, d.public_token)).toContainText("Anulată");
    await g.close();
    const { data: ci } = await admin().from("bookings").select("check_in").eq("id", a.booking_id).single();
    await page.goto(`/dashboard?de=${addDays(ci!.check_in as string, -2)}&zile=14`);
    await expect(page.locator(`[data-testid="chart-bar"][data-booking-id="${a.booking_id}"]`)).toHaveAttribute("data-status", "confirmed");
  });

  test("5 + 21: hold expirat -> „Expirată” + hold_expired; ora „expiră în …” cu ceas fixat; Confirmă ∥ Refuză = una câștigă", async ({ page, browser, baseURL }) => {
    const e = await request();
    // Clock fixed 2 h 30 min before the expiry: the row says "expiră în 2 h 30 min".
    await page.clock.setFixedTime(new Date(new Date(e.hold_expires_at).getTime() - (2 * 60 + 30) * 60_000));
    await page.goto("/dashboard/rezervari");
    await expect(row(page, e.booking_id).getByTestId("request-expiry")).toContainText("expiră în 2 h 30 min");

    // Expire it in the DB (no 24 h wait, no cron); the open page tries to confirm -> hold_expired.
    const past = new Date(Date.now() - 60_000).toISOString();
    expect((await admin().from("bookings").update({ hold_expires_at: past }).eq("id", e.booking_id)).error).toBeNull();
    await row(page, e.booking_id).getByTestId("request-confirm").click();
    await expect(page.getByTestId("requests-notice")).toContainText("Cererea a expirat");
    await expect(row(page, e.booking_id).getByTestId("request-status")).toContainText("Expirată");
    await expect(row(page, e.booking_id).getByTestId("request-confirm")).toHaveCount(0);
    await page.screenshot({ path: path.join(SHOTS, "panou-expirata-1440.png") });

    const g = await browser.newContext({ baseURL, storageState: GUEST_STATE });
    const gp = await g.newPage();
    await expect(await status(gp, e.public_token)).toContainText("Expirată");
    await gp.screenshot({ path: path.join(SHOTS, "stare-expirata-1440.png") });
    await g.close();

    // Confirm and decline at the same time: one wins, the other gets invalid_status.
    const p = await request();
    const owner1 = asUser(sessionFromStateFile(OWNER1_STATE).access_token);
    const [c, d] = await Promise.all([
      owner1.rpc("confirm_booking", { p_booking_id: p.booking_id }),
      owner1.rpc("decline_booking", { p_booking_id: p.booking_id }),
    ]);
    const outcomes = [c.error?.message ?? "ok", d.error?.message ?? "ok"].sort();
    expect(outcomes).toEqual(["invalid_status", "ok"]);
  });

  test("5: izolare — owner2 nu vede cererea lui owner1 și nu o poate confirma; panoul la 390", async ({ page, browser, baseURL }) => {
    const r = await request();
    const o2 = await browser.newContext({ baseURL, storageState: OWNER2_STATE });
    const p2 = await o2.newPage();
    await p2.goto("/dashboard/rezervari");
    await expect(p2.getByTestId("requests")).toBeVisible();
    await expect(row(p2, r.booking_id)).toHaveCount(0);
    await o2.close();
    const { error } = await asUser(sessionFromStateFile(OWNER2_STATE).access_token).rpc("confirm_booking", { p_booking_id: r.booking_id });
    expect(error?.message).toBe("booking_not_found");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/rezervari");
    await expect(row(page, r.booking_id)).toBeVisible();
    await noHorizontalScroll(page);
    await page.screenshot({ path: path.join(SHOTS, "panou-insigna-390.png") });
    expect.soft(axeList(await axeAA(page)), "axe /dashboard/rezervari 390").toEqual([]);
  });
});

test("6: fluxul complet al gazdei: cont nou -> proprietate -> unitate -> poză -> preț -> publicare -> cerere -> confirmare -> grafic + ocupare", async ({ page, browser, baseURL }) => {
  test.setTimeout(180_000);
  const errors = watchConsole(page);
  const email = `e2e+${Date.now()}@example.com`;
  const NAME = `E2E Flux ${TAG}`;

  await page.goto("/cont-nou");
  await page.getByLabel("Nume complet").fill("E2E Gazdă Flux");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Parolă", { exact: true }).fill("Parola-Noua-123");
  await page.getByRole("button", { name: "Creează contul" }).click();
  await expect(page.getByTestId("kpi-occupancy-value")).toBeVisible();
  const occBefore = (await page.getByTestId("kpi-occupancy-value").textContent())!.trim();

  await page.goto("/dashboard/proprietati");
  await page.getByTestId("property-add-empty").click(); // a new account starts with the empty state
  await page.getByTestId("property-create-name").fill(NAME);
  await page.getByTestId("property-create-city").fill("Brașov");
  await page.getByTestId("property-create-submit").click();
  await expect(page.getByTestId("property-detail")).toBeVisible();
  const propId = page.url().match(/proprietati\/([0-9a-f-]{36})/)![1];

  // Publish the property (status "activa").
  await page.locator("label", { has: page.getByTestId("details-status-activa") }).click();
  await expect(page.getByTestId("details-status-activa")).toBeChecked();
  await page.getByTestId("details-submit").click();
  await expect(page.getByTestId("details-saved")).toBeVisible();

  // Unit with a base price, published.
  await page.goto(`/dashboard/proprietati/${propId}?tab=unitati`);
  await page.getByTestId("unit-add").click();
  await page.getByTestId("unit-form-name").fill("E2E Camera Flux");
  await page.getByTestId("unit-form-price").fill("350");
  await page.getByTestId("unit-form-published").check();
  await page.getByTestId("unit-submit").click();
  const unitRow = page.getByTestId("unit-row").filter({ hasText: "E2E Camera Flux" });
  await expect(unitRow).toBeVisible();
  const unitId = (await unitRow.getAttribute("data-unit-id"))!;

  // One photo generated in the test.
  await page.goto(`/dashboard/proprietati/${propId}?tab=poze`);
  await page.getByTestId("photo-input").setInputFiles({ name: "camera.jpg", mimeType: "image/jpeg", buffer: await makeJpeg(page, 1600, 1067) });
  await page.getByTestId("photo-staged-alt").fill("Camera cu pat dublu");
  await page.getByTestId("photo-upload-submit").click();
  await expect(page.getByTestId("photo-card")).toHaveCount(1, { timeout: 30_000 });

  // The guest finds it on the site without a rebuild and sends a request.
  const g = await browser.newContext({ baseURL, storageState: GUEST_STATE });
  const gp = await g.newPage();
  await useIp(gp);
  const today = await bucharestToday();
  const stay = { from: addDays(today, 3), to: addDays(today, 5) };
  const token = await requestViaUi(gp, unitId, stay, { name: `E2E Oaspete Flux ${TAG}`, email: `e2e+fg${TAG}@example.com` });
  await gp.screenshot({ path: path.join(SHOTS, "flux-cerere-1440.png") });
  const { data: b } = await admin().from("bookings").select("id").eq("public_token", token).single();

  // The host confirms; the booking is in the chart and the occupancy changes.
  await page.goto("/dashboard/rezervari");
  await expect.poll(() => badge(page)).toBe(1);
  await row(page, b!.id).getByTestId("request-confirm").click();
  await expect.poll(() => badge(page)).toBe(0);
  await expect(await status(gp, token)).toContainText("Confirmată");
  await g.close();

  await page.goto(`/dashboard?de=${today}&zile=14`);
  await expect(page.locator(`[data-testid="chart-bar"][data-booking-id="${b!.id}"]`)).toHaveAttribute("data-status", "confirmed");
  const occAfter = (await page.getByTestId("kpi-occupancy-value").textContent())!.trim();
  expect(occAfter, "ocuparea se schimbă după confirmare").not.toBe(occBefore);
  await page.screenshot({ path: path.join(SHOTS, "flux-grafic-1440.png") });
  expect(errors).toEqual([]);
});
