import { expect, test } from "@playwright/test";

// Check 7: Robert's public page `/` is pixel-identical before (main) and after (this branch).
// Baseline: run against a `main` build with --update-snapshots (see playwright.config.ts, project "home").
test.use({ reducedMotion: "reduce" });

for (const { w, h } of [
  { w: 1440, h: 900 },
  { w: 390, h: 844 },
]) {
  test(`/ la ${w} identică cu main`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    // Freeze every video on its first frame so the comparison is stable.
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.querySelectorAll("video")).map((v) => {
          v.pause();
          v.currentTime = 0;
          return new Promise((r) => (v.readyState >= 2 ? r(null) : v.addEventListener("loadeddata", () => r(null), { once: true })));
        }),
      ),
    );
    // Every image that is (partly) on screen has loaded, so lazy loading does not change the result.
    await page.waitForFunction(
      () =>
        Array.from(document.images)
          .filter((i) => {
            const r = i.getBoundingClientRect();
            return r.top < window.innerHeight && r.bottom > 0 && r.width > 0;
          })
          .every((i) => i.complete && i.naturalWidth > 0),
      undefined,
      { timeout: 20_000 },
    );
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot(`home-${w}.png`, { animations: "disabled", maxDiffPixelRatio: 0.01 });
  });
}
