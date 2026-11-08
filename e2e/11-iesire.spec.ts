import { expect, test } from "@playwright/test";
import { NEW_USER_STATE, OWNER1_STATE } from "./support/helpers";

const DASH = ["/dashboard", "/dashboard/proprietati", "/dashboard/rezervari", "/dashboard/setari"];

// Check 11: sign-out is a POST action with signOut(); sb-* cookies cleared; /dashboard/* no-store.
test.describe("Cache-Control", () => {
  test.use({ storageState: OWNER1_STATE });
  test("/dashboard/* dinamic, Cache-Control: no-store", async ({ page }) => {
    for (const p of DASH) {
      const res = await page.goto(p);
      expect(res!.headers()["cache-control"], p).toMatch(/no-store/);
      expect(res!.headers()["x-nextjs-cache"] ?? "", p).not.toMatch(/HIT/);
    }
  });
});

test.describe("ieșire (contul nou din 01)", () => {
  test.use({ storageState: NEW_USER_STATE, viewport: { width: 1440, height: 900 } });

  test("POST + signOut, cookie-uri șterse, Înapoi + reîncărcare -> /login fără KPI", async ({ page, context }) => {
    await page.goto("/dashboard/setari");
    await page.goto("/dashboard");
    await expect(page.getByTestId("kpi-revenue-value")).toBeVisible();

    const actionRequest = page.waitForRequest((r) => r.method() === "POST" && Boolean(r.headers()["next-action"]));
    await page.locator("aside").getByRole("button", { name: "Ieși din cont" }).click();
    const req = await actionRequest;
    expect(req.method()).toBe("POST");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Intră în cont" })).toBeVisible();

    const sb = (await context.cookies()).filter((c) => c.name.startsWith("sb-"));
    expect(sb, JSON.stringify(sb.map((c) => c.name))).toEqual([]);

    // Back: no KPI even before a reload (no-store keeps the dashboard out of the back/forward cache).
    await page.goBack();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("kpi-revenue-value")).toHaveCount(0);
    expect(await page.content()).not.toContain("kpi-revenue-value");
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
    expect(await page.content()).not.toContain("kpi-revenue-value");

    // A direct visit also goes to /login.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
