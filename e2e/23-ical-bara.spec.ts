import { expect, test } from "@playwright/test";
import { OWNER1_STATE, admin, noHorizontalScroll, watchConsole } from "./support/helpers";
import { GUEST_PREFIX, SEL, addDays, bucharestToday, deleteE2EBookings, gotoChart } from "./support/chart";
import { deleteE2EProperties, insertProperty, insertUnit, owner1Org, runTag } from "./support/props";

// Brief 03 leftover: an imported (iCal) blocked bar shorter than 3 shown nights shows its source icon
// only; a longer one shows icon + source name; a direct block always shows its text.
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
  await deleteE2EBookings();
});

async function block(org: string, unit: string, check_in: string, nights: number, source: string, name: string) {
  const db = admin();
  const { data: g, error: ge } = await db.from("guests").insert({ organization_id: org, full_name: GUEST_PREFIX + name }).select("id").single();
  if (ge) throw ge;
  const { data, error } = await db
    .from("bookings")
    .insert({
      organization_id: org,
      unit_id: unit,
      guest_id: g.id,
      check_in,
      check_out: addDays(check_in, nights),
      status: "blocked",
      source,
      adults: 1,
      children: 0,
      total_amount: 0,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

for (const width of [1440, 390]) {
  test(`bara iCal sub 3 nopți = doar iconiță; 4 nopți = iconiță + sursă; blocare directă = text (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: width > 500 ? 900 : 844 });
    const org = await owner1Org();
    const prop = await insertProperty({ org, name: `iCal ${width} ${tag}` });
    const unit = await insertUnit({ org, property: prop, name: "E2E Camera iCal" });
    const today = await bucharestToday();
    const short = await block(org, unit, addDays(today, 1), 2, "booking", `iCal scurt ${tag}`);
    const long = await block(org, unit, addDays(today, 4), 4, "airbnb", `iCal lung ${tag}`);
    const direct = await block(org, unit, addDays(today, 9), 2, "direct", `Blocare ${tag}`);

    await gotoChart(page, today, 14, prop);
    const bar = (id: string) => page.locator(`${SEL.bar}[data-booking-id="${id}"]`);
    await expect(bar(short)).toBeVisible();

    await expect(bar(short)).toHaveAttribute("data-icon-only", "");
    await expect(bar(short)).toHaveAttribute("data-source", "booking");
    await expect(bar(short).locator("svg")).toHaveCount(1);
    await expect(bar(short).locator("span")).toHaveCount(0);
    await expect(bar(short)).toHaveText("");
    // The name is still there for screen readers and on hover.
    await expect(bar(short)).toHaveAttribute("aria-label", /Booking/);

    await expect(bar(long)).not.toHaveAttribute("data-icon-only", "");
    await expect(bar(long).locator("svg")).toHaveCount(1);
    await expect(bar(long)).toHaveText("Airbnb");

    await expect(bar(direct)).not.toHaveAttribute("data-icon-only", "");
    await expect(bar(direct)).not.toHaveText("");

    // The icon sits inside the short bar, not clipped out of it.
    const b = (await bar(short).boundingBox())!;
    const i = (await bar(short).locator("svg").boundingBox())!;
    expect(i.x).toBeGreaterThanOrEqual(b.x);
    expect(i.x + i.width).toBeLessThanOrEqual(b.x + b.width + 0.5);
    await noHorizontalScroll(page);
    await page.locator(`${SEL.row}[data-unit-id="${unit}"]`).screenshot({ path: `docs/briefs/04-capturi/ical-bara-${width}.png` });
  });
}
