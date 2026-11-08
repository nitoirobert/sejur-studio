import { expect, test } from "@playwright/test";
import { OWNER1_STATE } from "./support/helpers";

const PAGES = ["/dashboard", "/dashboard/proprietati", "/dashboard/rezervari", "/dashboard/setari"];

// Check 2: no session -> /login on every /dashboard/*; with a session /login and /cont-nou -> /dashboard.
test.describe("fără sesiune", () => {
  for (const path of [...PAGES, "/dashboard/nu-exista"]) {
    test(`${path} -> /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login(\?|$)/);
      await expect(page.getByRole("heading", { name: "Intră în cont" })).toBeVisible();
      await expect(page.getByTestId("kpi-revenue-value")).toHaveCount(0);
    });
  }

  test("redirectul păstrează pagina cerută în next", async ({ request }) => {
    const res = await request.get("/dashboard/rezervari", { maxRedirects: 0 });
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    expect(res.headers()["location"]).toMatch(/\/login\?next=%2Fdashboard%2Frezervari$/);
  });
});

test.describe("cu sesiune", () => {
  test.use({ storageState: OWNER1_STATE });
  for (const path of ["/login", "/cont-nou"]) {
    test(`${path} -> /dashboard`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByTestId("kpi-revenue-value")).toBeVisible();
    });
  }
});
