import { expect, test } from "@playwright/test";
import { safeNext } from "../src/lib/supabase/validation";
import { OWNER1_STATE, SEED, uniqueEmail } from "./support/helpers";

// Check 8: `next` accepts only internal paths; anything else goes to /dashboard.
const EVIL = ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "http:/evil.com", "/\tevil.com"];
// Dot segments that the URL parser collapses into "//evil.com" (QA block, brief 02 round 2).
const DOT = ["/.//evil.com", "/..//evil.com", "/%2e//evil.com", "/a/..//evil.com", "/%2E%2E//evil.com", "/./%2e//evil.com"];

// Never let a test browser actually leave for evil.com.
test.beforeEach(async ({ context }) => {
  await context.route((url) => url.hostname.endsWith("evil.com"), (route) => route.abort());
});

test("safeNext: doar căi interne", () => {
  for (const raw of EVIL) expect(safeNext(raw), raw).toBe("/dashboard");
  for (const raw of DOT) expect(safeNext(raw), raw).toBe("/dashboard");
  // A dot segment that stays inside the site is fine.
  expect(safeNext("/dashboard/./setari")).toBe("/dashboard/setari");
  expect(safeNext("/dashboard/setari")).toBe("/dashboard/setari");
  expect(safeNext("/dashboard/rezervari?zi=2026-11-07")).toBe("/dashboard/rezervari?zi=2026-11-07");
  // An encoded backslash stays a same-origin path (the browser does not decode it into a host).
  expect(safeNext("/%5Cevil.com")).toBe("/%5Cevil.com");
  expect(safeNext(undefined)).toBe("/dashboard");
  expect(safeNext("")).toBe("/dashboard");
});

test.describe("cu sesiune: /login?next=… (proxy)", () => {
  test.use({ storageState: OWNER1_STATE });
  for (const raw of ["https://evil.com", "//evil.com", "/\\evil.com"]) {
    test(`next=${raw} -> /dashboard pe același host`, async ({ page, baseURL }) => {
      await page.goto(`/login?next=${encodeURIComponent(raw)}`);
      await expect(page).toHaveURL(`${baseURL}/dashboard`);
      await expect(page.getByTestId("kpi-revenue-value")).toBeVisible();
    });
  }
  test("next intern e respectat", async ({ page, baseURL }) => {
    await page.goto(`/login?next=${encodeURIComponent("/dashboard/setari")}`);
    await expect(page).toHaveURL(`${baseURL}/dashboard/setari`);
  });
  test("Location nu iese de pe host (cerere brută)", async ({ request, baseURL }) => {
    for (const raw of ["https://evil.com", "//evil.com", "/\\evil.com", ...DOT]) {
      const res = await request.get(`/login?next=${encodeURIComponent(raw)}`, { maxRedirects: 0 });
      expect(new URL(res.headers()["location"], baseURL).href, raw).toBe(`${baseURL}/dashboard`);
    }
  });
});

test("formularul de login cu next=//evil.com -> /dashboard (o singură autentificare)", async ({ page, baseURL }) => {
  await page.goto(`/login?next=${encodeURIComponent("//evil.com")}`);
  await page.getByLabel("Email").fill(SEED.owner1.email);
  await page.getByLabel("Parolă", { exact: true }).fill(SEED.password);
  await page.getByRole("button", { name: "Intră în cont" }).click();
  await expect(page.getByTestId("kpi-revenue-value")).toBeVisible();
  await expect(page).toHaveURL(`${baseURL}/dashboard`);
});

test("formularul de cont nou cu next=/.//evil.com -> /dashboard pe același host", async ({ page, baseURL }) => {
  const email = uniqueEmail();
  await page.goto(`/cont-nou?next=${encodeURIComponent("/.//evil.com")}`);
  await expect(page.locator('input[name="next"]')).toHaveValue("/.//evil.com");
  await page.getByLabel("Nume complet").fill("Test Next");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Parolă", { exact: true }).fill("Parola-Noua-123");
  await page.getByRole("button", { name: "Creează contul" }).click();
  await expect(page.getByTestId("kpi-revenue-value")).toBeVisible();
  await expect(page).toHaveURL(`${baseURL}/dashboard`);
  // The account is an e2e+<timestamp> one: cleanup.teardown.ts deletes it.
});

test("formularul trimite next-ul primit, linkul spre cont nou îl păstrează", async ({ page }) => {
  await page.goto(`/login?next=${encodeURIComponent("https://evil.com")}`);
  await expect(page.locator('input[name="next"]')).toHaveValue("https://evil.com");
  // The server action ignores it (tested above via safeNext); the link carries it on unchanged.
  await expect(page.getByRole("link", { name: "Creează unul" })).toHaveAttribute("href", /\/cont-nou\?next=/);
});
