import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { OWNER1_STATE } from "./support/helpers";
import {
  GUEST_PREFIX,
  OWNER1_UNITS,
  SEL,
  addDays,
  bookingsFor,
  bucharestToday,
  deleteE2EBookings,
  dragSelect,
  fillForm,
  freeRange,
  gotoChart,
  submitButton,
} from "./support/chart";

// Brief 03, check 12: Europe/Bucharest days, DST nights, "azi" from the server.
test.use({ storageState: OWNER1_STATE });
test.afterAll(async () => {
  await deleteE2EBookings();
});

for (const tz of ["Europe/Bucharest", "America/New_York"]) {
  test.describe(tz, () => {
    test.use({ timezoneId: tz });

    for (const [label, from] of [
      ["29 martie (ora de vară)", "2026-03-26"],
      ["25 octombrie (ora de iarnă)", "2026-10-22"],
    ] as const) {
      test(`12: săptămâna cu ${label} are 7 coloane distincte, consecutive`, async ({ page }) => {
        await gotoChart(page, from, 7);
        const dates = await page.locator(SEL.day).evaluateAll((els) => els.map((e) => e.getAttribute("data-date")));
        expect(dates).toEqual(Array.from({ length: 7 }, (_, i) => addDays(from, i)));
        // Visible labels too: 7 different day numbers.
        const labels = await page.locator(SEL.day).allInnerTexts();
        expect(new Set(labels.map((l) => l.replace(/\s+/g, " ").trim())).size).toBe(7);
      });
    }

    test("12: „Azi” = bucharest_today() de pe server, oricare ar fi fusul browserului", async ({ page }) => {
      const today = await bucharestToday();
      await gotoChart(page);
      await expect(page.locator(SEL.chart)).toHaveAttribute("data-today", today);
      await expect(page.locator(SEL.todayLine).first()).toHaveAttribute("data-date", today);
      await expect(page.locator(`${SEL.day}[aria-current="date"]`)).toHaveAttribute("data-date", today);
      await page.locator(SEL.next).click();
      await page.locator(SEL.todayLink).click();
      await expect(page.locator(`${SEL.day}[data-date="${today}"]`)).toBeVisible();
    });
  });
}

test("12: tragerea peste zilele 10–12 trimite check_out = 13", async ({ page }) => {
  const unit = OWNER1_UNITS[5];
  const today = await bucharestToday();
  // Days 10..12 of a month with room: first free month start after today + 2 months.
  let base = addDays(today, 60).slice(0, 8) + "01";
  for (let i = 0; i < 6; i++) {
    const free = await freeRange(unit, addDays(base, 9), 3);
    if (free === addDays(base, 9)) break;
    base = addDays(base, 32).slice(0, 8) + "01";
  }
  const d10 = addDays(base, 9);
  await gotoChart(page, base, 30);
  await dragSelect(page, unit, d10, addDays(base, 11));
  await fillForm(page, { name: `${GUEST_PREFIX}Zile 10-12`, adults: "1", amount: "1" });
  await submitButton(page).click();
  await expect.poll(async () => (await bookingsFor(unit, d10, addDays(base, 12))).length).toBe(1);
  const [row] = await bookingsFor(unit, d10, addDays(base, 12));
  expect(row.check_in).toBe(d10);
  expect(row.check_out).toBe(addDays(base, 12));
});

test("12: codul de zile nu face +86400000 pe ora locală", () => {
  const roots = ["src/lib/dates", "src/components/dashboard/chart", "src/components/dashboard/booking"].map((p) => path.join(process.cwd(), p));
  const hits: string[] = [];
  const walk = (d: string) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.tsx?$/.test(f) && !/\.test\./.test(f))
        fs.readFileSync(f, "utf8").split(/\r?\n/).forEach((l, i) => {
          if (/86_?400_?000|24\s*\*\s*60\s*\*\s*60\s*\*\s*1000|\.setDate\(|\.getDate\(\)/.test(l)) hits.push(`${path.relative(process.cwd(), f)}:${i + 1}: ${l.trim()}`);
        });
    }
  };
  roots.forEach(walk);
  expect(fs.existsSync(roots[0]), "src/lib/dates exists").toBe(true);
  // A fixed day length is allowed only in a file that builds its instants with Date.UTC (UTC
  // midnights, as the brief allows); local-time getDate/setDate is never allowed.
  const local = hits.filter((h) => /\.setDate\(|\.getDate\(\)/.test(h));
  const fixedDay = hits.filter((h) => !local.includes(h)).filter((h) => !fs.readFileSync(path.join(process.cwd(), h.split(":")[0]), "utf8").includes("Date.UTC("));
  expect([...local, ...fixedDay]).toEqual([]);
});
