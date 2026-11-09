import { expect, test, type Page, type Request } from "@playwright/test";
import { OWNER1_STATE, readKpis, watchConsole } from "./support/helpers";
import {
  expectError,
  field,
  GUEST_PREFIX,
  OWNER1_UNITS,
  OWNER2_UNIT,
  SEL,
  addDays,
  bookingsFor,
  bucharestToday,
  cell,
  deleteE2EBookings,
  dragSelect,
  fillForm,
  freeRange,
  gotoChart,
  insertBooking,
  orgOfUnit,
  submitButton,
} from "./support/chart";

// Brief 03, checks 2, 3, 4, 10, 13 (+ the blocking part of 14). Every booking here has a guest
// named "E2E ..." and is deleted after each test and again in cleanup.teardown.ts.
test.use({ storageState: OWNER1_STATE });
test.afterEach(async () => {
  await deleteE2EBookings();
});

const isAction = (r: Request) => r.method() === "POST" && !!r.headers()["next-action"];

// The save is committed once the "saved" notice shows and no optimistic bar is left. Every DB read
// and the afterEach cleanup wait for this, so a row committed after the delete cannot leak.
async function expectSaved(page: Page, guest: string) {
  await expect(page.getByTestId("booking-saved")).toContainText(guest);
  await expect(page.locator(`${SEL.bar}[data-optimistic]`)).toHaveCount(0);
}

// A free range near today so the occupancy KPI (next 30 days) moves; unit 5 has few seed rows.
async function nearFree(unit: string, nights: number) {
  const today = await bucharestToday();
  return freeRange(unit, addDays(today, 1), nights);
}

// After a save the sheet is closed for good (Sheet.tsx no longer reopens it once the parent says
// closed): no open <dialog>, still none a moment later, and a click on the new bar opens the details.
async function expectSheetGoneThenDetails(page: Page, unit: string, start: string) {
  const sheet = page.locator(SEL.sheet);
  await expect(sheet).toBeHidden();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  // A late reopen (the old bug) came on the close event after the save: give it time to show.
  await page.waitForTimeout(600);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __sheetReopened?: number }).__sheetReopened ?? 0), "sheet reopened after the save").toBe(0);
  const bar = page.locator(`${SEL.bar}[data-unit-id="${unit}"][data-from="${start}"]`);
  await bar.scrollIntoViewIfNeeded();
  await bar.click();
  await expect(page.locator(SEL.panel)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(SEL.panel)).toBeHidden();
}

// Counts every time the booking sheet goes from closed to open after the save notice appeared.
async function watchSheetReopen(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __sheetReopened: number };
    w.__sheetReopened = 0;
    const dialog = document.querySelector('[data-testid="booking-sheet"]');
    if (!dialog) return;
    let wasOpen = dialog.hasAttribute("open");
    new MutationObserver(() => {
      const isOpen = dialog.hasAttribute("open");
      if (isOpen && !wasOpen && document.querySelector('[data-testid="booking-saved"]')) w.__sheetReopened++;
      wasOpen = isOpen;
    }).observe(dialog, { attributes: true, attributeFilter: ["open"] });
  });
}

async function openForm(page: Page, unit: string, start: string, nights: number) {
  await gotoChart(page, start, 14);
  await dragSelect(page, unit, start, addDays(start, nights - 1));
  await expect(page.locator(SEL.form)).toBeVisible();
}

test("2 + 4: rezervarea apare ca bară, KPI se schimbă fără reîncărcare, rămâne după reîncărcare; 450,50 -> 45050", async ({ page }) => {
  const errors = watchConsole(page);
  const unit = OWNER1_UNITS[4];
  const start = await nearFree(unit, 2);
  await openForm(page, unit, start, 2);
  const before = await readKpis(page);
  // "No reload" = the same document survives the save. (framenavigated is not usable: the action's
  // refresh() may touch history, which Playwright also reports as a navigation of the same document.)
  await page.evaluate(() => ((window as unknown as { __sameDoc: boolean }).__sameDoc = true));
  await fillForm(page, { name: `${GUEST_PREFIX}Ana Test`, email: "e2e.oaspete@example.com", phone: "+40700000123", adults: "2", children: "0", amount: "450,50" });
  await watchSheetReopen(page);
  await submitButton(page).click();

  const bar = page.locator(`${SEL.bar}[data-unit-id="${unit}"][data-from="${start}"]`);
  await expect(bar).toBeVisible();
  await expectSaved(page, "Ana Test");
  await expectSheetGoneThenDetails(page, unit, start);
  await expect(bar).not.toHaveAttribute("data-optimistic");
  await expect.poll(async () => (await readKpis(page)).occupancy).not.toBe(before.occupancy);
  expect(await page.evaluate(() => (window as unknown as { __sameDoc?: boolean }).__sameDoc), "no full reload").toBe(true);

  const rows = await bookingsFor(unit, start, addDays(start, 2));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ check_in: start, check_out: addDays(start, 2), status: "confirmed", source: "direct", adults: 2, children: 0, total_amount: 45050 });

  await page.reload();
  await expect(page.locator(`${SEL.bar}[data-unit-id="${unit}"][data-from="${start}"]`)).toHaveCount(1);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("3: suprapunere -> booking_overlap în română, bara optimistă dispare", async ({ page }) => {
  const unit = OWNER1_UNITS[4];
  const start = await nearFree(unit, 4);
  const org = await orgOfUnit(unit);
  await openForm(page, unit, start, 3);
  // Someone else takes the nights while the form is open.
  await insertBooking({ org, unit, check_in: addDays(start, 1), check_out: addDays(start, 2), status: "confirmed", name: "Ocupant" });
  const barsBefore = await page.locator(`${SEL.bar}[data-unit-id="${unit}"]`).count();
  await fillForm(page, { name: `${GUEST_PREFIX}Pierde`, adults: "2", amount: "100" });
  await submitButton(page).click();
  await expectError(page, "booking_overlap");
  await expect(page.locator(`${SEL.bar}[data-unit-id="${unit}"]`)).toHaveCount(barsBefore);
  expect(await bookingsFor(unit, start, addDays(start, 3))).toHaveLength(1);
});

test("3 + 4: erori în română pentru oaspete și sumă invalide; adulți ≥ 1, copii ≥ 0", async ({ page }) => {
  const unit = OWNER1_UNITS[4];
  const start = await nearFree(unit, 2);
  await openForm(page, unit, start, 2);
  const cases: [Record<string, string>, "invalid_guest" | "invalid_amount"][] = [
    [{ name: `${GUEST_PREFIX}X`, adults: "0", amount: "100" }, "invalid_guest"],
    [{ name: `${GUEST_PREFIX}X`, adults: "1", children: "-1", amount: "100" }, "invalid_guest"],
    [{ name: " ", adults: "1", amount: "100" }, "invalid_guest"],
    [{ name: `${GUEST_PREFIX}X`, adults: "1", amount: "450,505" }, "invalid_amount"],
    [{ name: `${GUEST_PREFIX}X`, adults: "1", amount: "abc" }, "invalid_amount"],
  ];
  for (const [v, msg] of cases) {
    await fillForm(page, { children: "0", ...v } as Parameters<typeof fillForm>[1]);
    await submitButton(page).click();
    await expectError(page, msg);
    await expect(page.locator(SEL.form)).not.toContainText(/violates|constraint|PGRST|P0002|23P01|22023|null value/i);
  }
  expect(await bookingsFor(unit, start, addDays(start, 2))).toHaveLength(0);
});

test("14: un hold activ blochează în UI; unul expirat nu", async ({ page }) => {
  const unit = OWNER1_UNITS[4];
  const org = await orgOfUnit(unit);
  const start = await nearFree(unit, 6);
  await insertBooking({ org, unit, check_in: start, check_out: addDays(start, 2), status: "hold", hold_expires_at: new Date(Date.now() + 3_600_000).toISOString(), name: "Hold activ" });
  await insertBooking({ org, unit, check_in: addDays(start, 3), check_out: addDays(start, 5), status: "hold", hold_expires_at: new Date(Date.now() - 60_000).toISOString(), name: "Hold expirat" });
  await gotoChart(page, start, 14);
  // Cells under a live hold do not open the form.
  await dragSelect(page, unit, start, addDays(start, 1));
  await expect(page.locator(SEL.form)).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.locator(SEL.panel)).toBeHidden();
  // Cells under the live hold are not free; under the expired hold they are.
  await expect(cell(page, unit, start)).not.toHaveAttribute("data-free", "");
  await expect(cell(page, unit, addDays(start, 3))).toHaveAttribute("data-free", "");
  await expect(cell(page, unit, addDays(start, 4))).toHaveAttribute("data-free", "");
  // Over the expired hold the booking goes through.
  await dragSelect(page, unit, addDays(start, 3), addDays(start, 4));
  await fillForm(page, { name: `${GUEST_PREFIX}Peste expirat`, adults: "1", amount: "10" });
  await submitButton(page).click();
  await expectSaved(page, "Peste expirat");
  await expect(page.locator(`${SEL.bar}[data-unit-id="${unit}"][data-from="${addDays(start, 3)}"][data-status="confirmed"]`)).toBeVisible();
});

test.describe("13: concurență", () => {
  test("două taburi pe aceleași zile: 1 rând în DB, tabul care pierde arată booking_overlap și revine", async ({ browser }) => {
    const unit = OWNER1_UNITS[4];
    const start = await nearFree(unit, 2);
    const ctxs = await Promise.all([1, 2].map(() => browser.newContext({ storageState: OWNER1_STATE })));
    const [a, b] = await Promise.all(ctxs.map((c) => c.newPage()));
    for (const p of [a, b]) await openForm(p, unit, start, 2);
    // Both tabs' KPIs before either submits: the loser must come back to exactly these.
    const kpiBefore = new Map([[a, await readKpis(a)], [b, await readKpis(b)]]);
    await fillForm(a, { name: `${GUEST_PREFIX}Tab A`, adults: "1", amount: "100" });
    await fillForm(b, { name: `${GUEST_PREFIX}Tab B`, adults: "1", amount: "100" });
    await Promise.all([submitButton(a).click(), submitButton(b).click()]);
    // Both requests settled (one notice, one error) before the DB is read.
    await expect.poll(async () => (await a.getByTestId("booking-saved").count()) + (await b.getByTestId("booking-saved").count())).toBe(1);

    await expect.poll(async () => (await bookingsFor(unit, start, addDays(start, 2))).length).toBe(1);
    const winner = (await bookingsFor(unit, start, addDays(start, 2)))[0] as unknown as { guests: { full_name: string } };
    const loser = winner.guests.full_name.endsWith("Tab A") ? b : a;
    await expectError(loser, "booking_overlap");
    await expect.poll(() => readKpis(loser)).toEqual(kpiBefore.get(loser));
    await expect(loser.locator(`${SEL.bar}[data-unit-id="${unit}"][data-from="${start}"][data-optimistic]`)).toHaveCount(0);
    await Promise.all(ctxs.map((c) => c.close()));
  });

  test("dublu-clic pe trimite creează o singură rezervare; după succes 1 bară, și după reîncărcare", async ({ page }) => {
    const unit = OWNER1_UNITS[4];
    const start = await nearFree(unit, 2);
    await openForm(page, unit, start, 2);
    await fillForm(page, { name: `${GUEST_PREFIX}Dublu`, adults: "1", amount: "100" });
    const posts: Request[] = [];
    page.on("request", (r) => isAction(r) && posts.push(r));
    await submitButton(page).dblclick();
    const bars = page.locator(`${SEL.bar}[data-unit-id="${unit}"][data-from="${start}"]`);
    await expect(bars).toHaveCount(1);
    await expectSaved(page, "Dublu");
    await page.waitForLoadState("networkidle"); // a second POST, if any, has been sent by now
    expect(posts.map((r) => r.url()), "server action POSTs for one double click").toHaveLength(1);
    expect(await bookingsFor(unit, start, addDays(start, 2))).toHaveLength(1);
    await expect(bars).toHaveCount(1);
    await page.reload();
    await expect(page.locator(`${SEL.bar}[data-unit-id="${unit}"][data-from="${start}"]`)).toHaveCount(1);
  });

  for (const mode of ["abort", "500"] as const) {
    test(`${mode}: rollback, formularul își păstrează datele`, async ({ page }) => {
      const unit = OWNER1_UNITS[4];
      const start = await nearFree(unit, 2);
      await openForm(page, unit, start, 2);
      const kpi = await readKpis(page);
      const barsBefore = await page.locator(`${SEL.bar}[data-unit-id="${unit}"]`).count();
      await page.route("**/dashboard**", (route) => {
        if (!isAction(route.request())) return route.continue();
        return mode === "abort" ? route.abort("failed") : route.fulfill({ status: 500, body: "boom" });
      });
      await fillForm(page, { name: `${GUEST_PREFIX}Rollback`, email: "rb@example.com", adults: "3", amount: "450,50" });
      await submitButton(page).click();
      await expect(page.locator(SEL.formError)).toBeVisible();
      await expect(page.locator(SEL.formError)).not.toContainText(/boom|fetch|500/i);
      await expect(page.locator(`${SEL.bar}[data-unit-id="${unit}"]`)).toHaveCount(barsBefore);
      expect(await readKpis(page)).toEqual(kpi);
      await expect(field(page, "name")).toHaveValue(`${GUEST_PREFIX}Rollback`);
      await expect(field(page, "email")).toHaveValue("rb@example.com");
      await expect(field(page, "adults")).toHaveValue("3");
      await expect(field(page, "amount")).toHaveValue("450,50");
      expect(await bookingsFor(unit, start, addDays(start, 2))).toHaveLength(0);
    });
  }
});

test("10: cerere directă: câmpuri în plus ignorate/refuzate, unit_id străin = unit_not_found, fără erori Postgres", async ({ page }) => {
  const unit = OWNER1_UNITS[4];
  const start = await nearFree(unit, 2);
  await openForm(page, unit, start, 2);
  await fillForm(page, { name: `${GUEST_PREFIX}Direct`, adults: "1", amount: "100" });
  // Capture the real server action call, block it, then replay variants of its body.
  let captured: { url: string; headers: Record<string, string>; body: string } | null = null;
  await page.route("**/dashboard**", async (route) => {
    const r = route.request();
    if (!isAction(r) || captured) return route.continue();
    captured = { url: r.url(), headers: r.headers(), body: r.postData() ?? "" };
    return route.abort("failed");
  });
  await submitButton(page).click();
  await expect.poll(() => captured).not.toBeNull();
  const c = captured!;
  expect(c.body, "captured action body carries the unit id").toContain(unit);

  const send = async (body: string) => {
    const res = await page.request.post(c.url, { headers: { ...c.headers, "content-length": String(Buffer.byteLength(body)) }, data: body });
    return { status: res.status(), text: await res.text() };
  };
  const injected = c.body.replace(/("unit_?[iI]d"\s*:\s*"[^"]+")/, '$1,"organization_id":"00000000-0000-4000-8000-000000000000","status":"blocked","source":"airbnb"');
  const r1 = await send(injected);
  expect(r1.text).toContain("invalid_input");
  expect(r1.text).not.toMatch(/violates|constraint|PGRST|SQLSTATE|23P01|22023|P0002/i);
  const rows = await bookingsFor(unit, start, addDays(start, 2));
  // .strict(): either refused (0 rows) or, if accepted, status/source/org are the server's own.
  for (const row of rows) expect(row).toMatchObject({ status: "confirmed", source: "direct", organization_id: await orgOfUnit(unit) });

  await deleteE2EBookings();
  const r2 = await send(c.body.split(unit).join(OWNER2_UNIT));
  expect(r2.text).toContain("unit_not_found");
  expect(r2.text).not.toMatch(/violates|constraint|PGRST|SQLSTATE|P0002/i);
  expect(await bookingsFor(OWNER2_UNIT, start, addDays(start, 2))).toHaveLength(0);
});

test("3 + 11: date invalide -> invalid_dates în română, fără bară și fără rând", async ({ page }) => {
  const unit = OWNER1_UNITS[4];
  const start = await nearFree(unit, 2);
  await openForm(page, unit, start, 2);
  const barsBefore = await page.locator(`${SEL.bar}[data-unit-id="${unit}"]`).count();
  await fillForm(page, { name: `${GUEST_PREFIX}Date`, adults: "1", amount: "100" });
  // Check-out on the check-in day, then before it, then 367 nights later.
  for (const out of [start, addDays(start, -1), addDays(start, 367)]) {
    await field(page, "check-out").fill(out);
    await submitButton(page).click();
    await expectError(page, "invalid_dates");
    await expect(page.locator(`${SEL.bar}[data-unit-id="${unit}"]`)).toHaveCount(barsBefore);
  }
  expect(await bookingsFor(unit, addDays(start, -1), addDays(start, 368))).toHaveLength(0);
});

test("11: „450.505” e refuzat cu invalid_amount (punct de mii fără virgulă)", async ({ page }) => {
  const unit = OWNER1_UNITS[4];
  const start = await nearFree(unit, 2);
  await openForm(page, unit, start, 2);
  for (const amount of ["450.505", "1.500"]) {
    await fillForm(page, { name: `${GUEST_PREFIX}Suma`, adults: "1", amount });
    await submitButton(page).click();
    await expectError(page, "invalid_amount");
  }
  expect(await bookingsFor(unit, start, addDays(start, 2))).toHaveLength(0);
});

test("13: foaia nu se închide cât timp se salvează (Esc, X, fundal)", async ({ page }) => {
  const unit = OWNER1_UNITS[4];
  const start = await nearFree(unit, 2);
  await openForm(page, unit, start, 2);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/dashboard**", async (route) => {
    if (!isAction(route.request())) return route.continue();
    await gate;
    return route.continue();
  });
  await fillForm(page, { name: `${GUEST_PREFIX}Salvare lentă`, adults: "1", amount: "100" });
  await watchSheetReopen(page);
  await submitButton(page).click();
  await expect(page.locator(SEL.form)).toHaveAttribute("aria-busy", "true");

  // Esc twice: Chrome forces the second cancel through; the sheet must still stay open.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.locator(SEL.form)).toBeVisible();
  await expect(page.locator(SEL.sheet)).toHaveAttribute("open", "");
  await page.locator(SEL.sheet).getByRole("button", { name: /închide/i }).click({ force: true });
  await expect(page.locator(SEL.form)).toBeVisible();
  // Backdrop: a click on the <dialog> element itself, outside the panel.
  await page.mouse.click(5, 5);
  await expect(page.locator(SEL.form)).toBeVisible();
  await expect(field(page, "name")).toHaveValue(`${GUEST_PREFIX}Salvare lentă`);

  release();
  await expectSaved(page, "Salvare lentă");
  await expect(page.locator(SEL.form)).toBeHidden();
  await expectSheetGoneThenDetails(page, unit, start);
  expect(await bookingsFor(unit, start, addDays(start, 2))).toHaveLength(1);
});

test("13 @390, CPU 6x mai lent: după salvare foaia rămâne închisă, clic pe bară deschide detaliile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  const errors = watchConsole(page);
  const unit = OWNER1_UNITS[4];
  const start = await nearFree(unit, 2);
  await openForm(page, unit, start, 2);
  await fillForm(page, { name: `${GUEST_PREFIX}Telefon lent`, adults: "2", amount: "200" });
  await watchSheetReopen(page);
  await submitButton(page).click();
  // Esc twice while it saves, as a thumb on a slow phone would.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expectSaved(page, "Telefon lent");
  await expectSheetGoneThenDetails(page, unit, start);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  expect(await bookingsFor(unit, start, addDays(start, 2))).toHaveLength(1);
  expect(errors, errors.join("\n")).toEqual([]);
});
