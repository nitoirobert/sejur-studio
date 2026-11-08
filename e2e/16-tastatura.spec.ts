import { expect, test } from "@playwright/test";
import { OWNER1_STATE, sessionFromStateFile } from "./support/helpers";
import { SEL, addDays, bucharestToday, chartRows, gotoChart } from "./support/chart";

// Brief 03, check 7: Tab reaches the bars, Enter opens the details, Esc closes, aria-label.
test.use({ storageState: OWNER1_STATE });

test("7: Tab ajunge pe bare, Enter deschide panoul, Esc îl închide; aria-label cu oaspete și date", async ({ page }) => {
  const today = await bucharestToday();
  const from = today.slice(0, 8) + "01";
  await gotoChart(page, from, 30);
  const { rows } = await chartRows(sessionFromStateFile(OWNER1_STATE).access_token, from, addDays(from, 30));
  const named = rows.find((r) => r.guest_name)!;

  // aria-label of every bar: guest name (or the block label) + dates.
  const labels = await page.locator(SEL.bar).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
  for (const l of labels) expect(l, "bar aria-label has a date").toMatch(/\d/);
  const bar = page.locator(`${SEL.bar}[data-booking-id="${named.booking_id}"]`);
  await expect(bar).toHaveAttribute("aria-label", new RegExp(named.guest_name!));

  // Tab from the chart toolbar until a bar has focus (bounded).
  await page.locator(SEL.chart).focus().catch(() => undefined);
  let reached = false;
  for (let i = 0; i < 60 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate((s) => !!document.activeElement?.matches(s), SEL.bar);
  }
  expect(reached, "Tab reaches a bar").toBe(true);

  await bar.focus();
  await page.keyboard.press("Enter");
  const panel = page.locator(SEL.panel);
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(named.guest_name!);
  // Read-only: no editable field in the panel.
  await expect(panel.locator("input:not([type=hidden]), textarea, select")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  // Focus returns to the bar that opened it.
  await expect(bar).toBeFocused();
});
