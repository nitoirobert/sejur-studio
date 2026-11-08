import { expect, test } from "@playwright/test";
import { OWNER1_STATE, OWNER2_STATE, sessionFromStateFile, watchConsole } from "./support/helpers";
import {
  OWNER1_PROPS,
  OWNER1_UNITS,
  OWNER2_PROP,
  P,
  SEL,
  addDays,
  bucharestToday,
  chartRows,
  chartUrl,
  deleteE2EBookings,
  freeRange,
  gotoChart,
  insertBooking,
  orgOfUnit,
} from "./support/chart";

// Brief 03, checks 1, 5, 6, 14: what the chart shows (read-only paths).
test.afterAll(async () => {
  await deleteE2EBookings();
});

test.describe("owner1", () => {
  test.use({ storageState: OWNER1_STATE });

  test("1: barele = dashboard_chart pe interval; bara se termină înaintea zilei de check-out", async ({ page }) => {
    const errors = watchConsole(page);
    const today = await bucharestToday();
    const from = today.slice(0, 8) + "01"; // seed month start: every seed row is around it
    const to = addDays(from, 30);
    const { rows, error } = await chartRows(sessionFromStateFile(OWNER1_STATE).access_token, from, to);
    expect(error).toBeNull();
    expect(rows.length).toBeGreaterThan(5);
    await gotoChart(page, from, 30);

    const bars = page.locator(SEL.bar);
    await expect(bars).toHaveCount(rows.length);
    const shownIds = await bars.evaluateAll((els) => els.map((e) => e.getAttribute("data-booking-id")).sort());
    expect(shownIds).toEqual(rows.map((r) => r.booking_id).sort());

    let endChecked = 0;
    for (const r of rows) {
      const bar = page.locator(`${SEL.bar}[data-booking-id="${r.booking_id}"]`);
      await expect(bar).toHaveAttribute("data-status", r.status);
      await expect(bar).toHaveAttribute("data-unit-id", r.unit_id);
      // Last night drawn = check_out - 1 (or the window end), never the check-out day.
      // data-to is exclusive: the check-out day (or the window end), so the last drawn night is check_out - 1.
      await expect(bar).toHaveAttribute("data-to", r.check_out < to ? r.check_out : to);
      await expect(bar).toHaveAttribute("data-check-out", r.check_out);
      if (r.check_out < to) {
        const coHeader = page.locator(`${SEL.day}[data-date="${r.check_out}"]`);
        const [bb, hb] = [await bar.boundingBox(), await coHeader.boundingBox()];
        expect(bb, `${r.booking_id} bar has a box`).not.toBeNull();
        expect(hb, `${r.check_out} header has a box`).not.toBeNull();
        expect(bb!.x + bb!.width, `${r.booking_id} ends before ${r.check_out}`).toBeLessThanOrEqual(hb!.x + 2);
        endChecked++;
      }
    }
    expect(endChecked, "rows whose bar end was checked against the check-out header").toBeGreaterThan(0);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("6: ‹ Azi ›, 7/14/30 și filtrul păstrează starea în URL", async ({ page }) => {
    const today = await bucharestToday();
    await gotoChart(page, today, 7);
    await expect(page.locator(SEL.day)).toHaveCount(7);

    await page.locator(SEL.next).click();
    await expect(page).toHaveURL(new RegExp(`${P.from}=${addDays(today, 7)}`));
    await page.locator(SEL.prev).click();
    await expect(page).toHaveURL(new RegExp(`${P.from}=${today}`));
    await page.locator(SEL.next).click();
    await page.locator(SEL.todayLink).click();
    await expect(page.locator(`${SEL.day}[data-date="${today}"]`)).toBeVisible();

    for (const n of [14, 30, 7]) {
      await page.locator(SEL.view(n)).click();
      await expect(page.locator(SEL.view(n))).toHaveAttribute("aria-current", "true");
      await expect(page).toHaveURL(new RegExp(`${P.days}=${n}`));
      await expect(page.locator(SEL.day)).toHaveCount(n);
    }

    await page.locator(SEL.property).selectOption(OWNER1_PROPS[1]);
    await expect(page).toHaveURL(new RegExp(`${P.property}=${OWNER1_PROPS[1]}`));
    await expect(page.locator(SEL.row)).toHaveCount(3);

    // The state survives a reload and the back button.
    const url = page.url();
    await page.reload();
    await expect(page.locator(SEL.day)).toHaveCount(7);
    await expect(page.locator(SEL.row)).toHaveCount(3);
    expect(page.url()).toBe(url);
  });

  test("14: bara care trece de fereastră e tăiată; check_out = de nu apare", async ({ page }) => {
    const unit = OWNER1_UNITS[1];
    const org = await orgOfUnit(unit);
    const start = await freeRange(unit, addDays(await bucharestToday(), 120), 10);
    const crossing = await insertBooking({ org, unit, check_in: start, check_out: addDays(start, 6), status: "confirmed", name: "Taiere" });
    const de = addDays(start, 3);
    await gotoChart(page, de, 7);
    const bar = page.locator(`${SEL.bar}[data-booking-id="${crossing}"]`);
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute("data-from", de);
    await expect(bar).toHaveAttribute("data-to", addDays(start, 6));
    await expect(bar).toHaveAttribute("data-clip-start", /.*/);
    // Window that starts on the check-out day: the booking is not drawn.
    await gotoChart(page, addDays(start, 6), 7);
    await expect(page.locator(`${SEL.bar}[data-booking-id="${crossing}"]`)).toHaveCount(0);
  });

  test("14: hold activ hașurat și blochează; hold expirat nu apare și nu blochează", async ({ page }) => {
    const unit = OWNER1_UNITS[2];
    const org = await orgOfUnit(unit);
    const start = await freeRange(unit, addDays(await bucharestToday(), 150), 12);
    const live = await insertBooking({
      org, unit, check_in: start, check_out: addDays(start, 3), status: "hold",
      hold_expires_at: new Date(Date.now() + 3_600_000).toISOString(), name: "Hold activ",
    });
    const dead = await insertBooking({
      org, unit, check_in: addDays(start, 6), check_out: addDays(start, 9), status: "hold",
      hold_expires_at: new Date(Date.now() - 60_000).toISOString(), name: "Hold expirat",
    });
    await gotoChart(page, start, 14);
    const liveBar = page.locator(`${SEL.bar}[data-booking-id="${live}"]`);
    await expect(liveBar).toHaveAttribute("data-status", "hold");
    const bg = await liveBar.evaluate((e) => getComputedStyle(e).backgroundImage);
    expect(bg, "hold is hatched (repeating gradient)").toMatch(/gradient/);
    await expect(page.locator(`${SEL.bar}[data-booking-id="${dead}"]`)).toHaveCount(0);
    // Blocking is checked against the RPC (the UI path is in 14-rezervare): live hold -> overlap,
    // expired hold -> booking goes through.
  });

  test("14: valori URL greșite revin la implicit, fără 500", async ({ page }) => {
    for (const q of [
      `?${P.from}=abc&${P.days}=999`,
      `?${P.from}=2026-02-30&${P.days}=-3`,
      `?${P.days}=7.5&${P.property}=nu-e-uuid`,
      `?${P.from}=99999-01-01`,
      `?${P.property}=00000000-0000-4000-8000-000000000000`,
    ]) {
      const res = await page.goto(`/dashboard${q}`);
      expect(res?.status(), q).toBeLessThan(500);
      await expect(page.locator(SEL.chart), q).toBeVisible();
    }
  });

  test("5/14: proprietatea lui owner2 în URL nu arată nicio unitate a nimănui", async ({ page }) => {
    await gotoChart(page, await bucharestToday(), 30, OWNER2_PROP);
    // Either an empty chart or a fallback to "all my properties"; never owner2's unit.
    await expect(page.locator(`${SEL.row}[data-unit-id^="b2000000"]`)).toHaveCount(0);
    await expect(page.getByText("Camera 1", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Oaspete Org Doi")).toHaveCount(0);
  });
});

test.describe("owner2", () => {
  test.use({ storageState: OWNER2_STATE });

  test("5: owner2 nu vede nicio bară a lui owner1; p_property_id străin dă listă goală sau eroare", async ({ page }) => {
    const token = sessionFromStateFile(OWNER2_STATE).access_token;
    const today = await bucharestToday();
    const from = today.slice(0, 8) + "01";
    for (const prop of OWNER1_PROPS) {
      const { rows, error } = await chartRows(token, from, addDays(from, 60), prop);
      expect(error !== null || rows.length === 0, `foreign property ${prop}`).toBe(true);
    }
    await gotoChart(page, from, 30);
    const units = await page.locator(SEL.bar).evaluateAll((els) => els.map((e) => e.getAttribute("data-unit-id")));
    expect(units.filter((u) => u?.startsWith("b1000000"))).toEqual([]);
    for (const name of ["Maria Ionescu", "Radu Stan", "Căsuța din Brazi"]) {
      await expect(page.getByText(name)).toHaveCount(0);
    }
    await page.goto(chartUrl(from, 30, OWNER1_PROPS[0]));
    await expect(page.locator(`${SEL.row}[data-unit-id^="b1000000"]`)).toHaveCount(0);
  });
});
