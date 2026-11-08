import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  OWNER1_STATE,
  SHOTS_DIR,
  axeAA,
  noCedilla,
  noHorizontalScroll,
  pixelContrast,
  setTheme,
  watchConsole,
} from "./support/helpers";

// Check 6: screenshot set docs/briefs/02-capturi/<pagina>-<latime>-<zi|noapte>.png,
// comma-below ș ț, axe WCAG A/AA with no violations on the glass, and the color-contrast
// nodes axe leaves "incomplete" (glass over the photo) measured on the rendered pixels.
const PAGES = [
  { name: "login", path: "/login", auth: false, ready: "Intră în cont" },
  { name: "cont-nou", path: "/cont-nou", auth: false, ready: "Cont nou de gazdă" },
  { name: "prezentare", path: "/dashboard", auth: true, ready: "booking-chart" },
  { name: "proprietati", path: "/dashboard/proprietati", auth: true, ready: "empty-state" },
  { name: "rezervari", path: "/dashboard/rezervari", auth: true, ready: "empty-state" },
  { name: "setari", path: "/dashboard/setari", auth: true, ready: "empty-state" },
] as const;
const W1440 = { w: 1440, h: 900 };
const W768 = { w: 768, h: 1024 };
const W390 = { w: 390, h: 844 };
// 768 (icon rail) for Prezentare and one empty page; 1440 + 390 for all.
const widthsFor = (name: string) => (["prezentare", "proprietati"].includes(name) ? [W1440, W768, W390] : [W1440, W390]);
const THEMES = [
  { theme: "light", label: "zi" },
  { theme: "dark", label: "noapte" },
] as const;

test.beforeAll(() => fs.mkdirSync(SHOTS_DIR, { recursive: true }));

async function checkPage(page: Page) {
  await noCedilla(page);
  await noHorizontalScroll(page);
  const axe = await axeAA(page);
  const summary = axe.violations
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => JSON.stringify(n.target)).join("\n  ")}`)
    .join("\n");
  expect(axe.violations, summary).toEqual([]);
  const px = await pixelContrast(
    page,
    axe.contrastIncomplete.map((n) => n.target),
  );
  test.info().annotations.push({
    type: "axe-incomplete",
    description: axe.incomplete.map((i) => `${i.id}:${i.count}`).join(", ") || "none",
  });
  test.info().annotations.push({
    type: "contrast-pixels",
    description: `measured ${px.checked.length}: ${px.checked.join(", ") || "-"}; not visible ${px.notVisible.length}`,
  });
  expect(px.failures, px.failures.join("\n")).toEqual([]);
}

for (const p of PAGES) {
  for (const { w, h } of widthsFor(p.name)) {
    for (const { theme, label } of THEMES) {
      const file = `${p.name}-${w}-${label}.png`;
      test.describe(file, () => {
        test.use({ viewport: { width: w, height: h }, storageState: p.auth ? OWNER1_STATE : undefined });

        test(`${file}: captură, diacritice, axe AA, contrast pe pixeli`, async ({ page, context }) => {
          const errors = watchConsole(page);
          await setTheme(context, theme);
          await page.goto(p.path);
          if (p.ready.includes("-")) await expect(page.getByTestId(p.ready)).toBeVisible();
          else await expect(page.getByRole("heading", { level: 1, name: p.ready })).toBeVisible();
          if (p.name === "prezentare") {
            await expect(page.getByTestId("kpi-revenue-value")).toBeVisible();
            await expect(page.getByTestId("chart-row").first()).toBeVisible();
          }
          await expect(page.locator("html")).toHaveClass(theme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b).*$/);
          await page.waitForLoadState("networkidle");
          await page.evaluate(() => document.fonts.ready);

          await page.screenshot({ path: path.join(SHOTS_DIR, file), fullPage: true, animations: "disabled" });
          await checkPage(page);
          expect(errors, errors.join("\n")).toEqual([]);
        });
      });
    }
  }
}

// The phone drawer, open, on Prezentare.
for (const { theme, label } of THEMES) {
  const file = `sertar-390-${label}.png`;
  test.describe(file, () => {
    test.use({ viewport: { width: W390.w, height: W390.h }, storageState: OWNER1_STATE });

    test(`${file}: sertar deschis, captură, axe AA, contrast pe pixeli`, async ({ page, context }) => {
      const errors = watchConsole(page);
      await setTheme(context, theme);
      await page.goto("/dashboard");
      await expect(page.getByTestId("kpi-revenue-value")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      const burger = page.getByRole("button", { name: "Deschide meniul" });
      await burger.click();
      const drawer = page.locator("#dashboard-drawer");
      await expect(drawer).toBeInViewport({ ratio: 1 });
      await expect(burger).toHaveAttribute("aria-expanded", "true");
      // Let the slide-in finish before the shot.
      await page.waitForTimeout(600);

      await page.screenshot({ path: path.join(SHOTS_DIR, file), animations: "disabled" });
      await checkPage(page);
      expect(errors, errors.join("\n")).toEqual([]);
    });
  });
}
