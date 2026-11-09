import { expect, test, type Page } from "@playwright/test";
import { OWNER1_STATE, noHorizontalScroll } from "./support/helpers";

test.use({ storageState: OWNER1_STATE });

const ITEMS = ["Prezentare", "Proprietăți", "Rezervări", "Setări"];
const PAGES = ["/dashboard", "/dashboard/proprietati", "/dashboard/rezervari", "/dashboard/setari"];

// The visible rail (aside), not the phone drawer.
const rail = (page: Page) => page.locator("aside nav");

test.describe("1440: meniu complet", () => {
  test("4 intrări cu etichete vizibile, activul cu aria-current, Tab + Enter", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("kpi-revenue-value")).toBeVisible();
    const links = rail(page).getByRole("link").filter({ hasText: new RegExp(`^(${ITEMS.join("|")})$`) });
    await expect(links).toHaveText(ITEMS);
    for (const label of ITEMS) await expect(rail(page).getByText(label, { exact: true })).toBeVisible();
    await expect(rail(page).locator('[aria-current="page"]')).toHaveText("Prezentare");
    const box = await rail(page).boundingBox();
    expect(box!.width).toBeGreaterThan(200);

    // Keyboard: Tab until "Rezervări" has focus, Enter opens it.
    await page.locator("body").focus();
    let found = false;
    for (let i = 0; i < 15 && !found; i++) {
      await page.keyboard.press("Tab");
      found = await page.evaluate(() => document.activeElement?.textContent?.trim() === "Rezervări");
    }
    expect(found, "Rezervări reachable with Tab").toBe(true);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/dashboard\/rezervari$/);
    await expect(rail(page).locator('[aria-current="page"]')).toHaveText("Rezervări");
    await expect(page.getByTestId("empty-state")).toBeVisible();
  });
});

test.describe("768: doar iconuri", () => {
  test.use({ viewport: { width: 768, height: 1024 } });
  test("meniul e îngust, etichetele doar pentru cititoare; fără ☰; fără scroll orizontal", async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      await expect(rail(page)).toBeVisible();
      const box = await rail(page).boundingBox();
      expect(box!.width).toBeLessThan(110);
      for (const label of ITEMS) {
        const link = rail(page).getByRole("link", { name: label, exact: true });
        await expect(link).toBeVisible();
        const labelBox = await link.getByText(label, { exact: true }).boundingBox();
        // sr-only: 1x1 px
        expect(labelBox!.width).toBeLessThanOrEqual(1);
      }
      await expect(page.getByRole("button", { name: "Deschide meniul" })).toBeHidden();
      await noHorizontalScroll(page);
    }
  });
});

test.describe("390: sertar", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("fără meniu lateral, fără scroll orizontal pe toate paginile", async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(rail(page)).toBeHidden();
      await expect(page.getByRole("button", { name: "Deschide meniul" })).toBeVisible();
      await noHorizontalScroll(page);
    }
  });

  async function open(page: Page) {
    const burger = page.getByRole("button", { name: "Deschide meniul" });
    await burger.click();
    const drawer = page.locator("#dashboard-drawer");
    await expect(drawer).toBeInViewport();
    await expect(burger).toHaveAttribute("aria-expanded", "true");
    return { burger, drawer };
  }

  test("Esc închide, focusul revine pe ☰", async ({ page }) => {
    await page.goto("/dashboard");
    const { burger, drawer } = await open(page);
    // Robert's "Înapoi la site" (Sidebar.tsx, d5d824b) closes the list and leads to the public site.
    await expect(drawer.locator("nav").getByRole("link")).toHaveText([...ITEMS, "Înapoi la site"]);
    await expect(drawer.locator("nav").getByRole("link", { name: "Înapoi la site" })).toHaveAttribute("href", "/");
    await expect(drawer.locator('[aria-current="page"]')).toHaveText("Prezentare");
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeInViewport();
    await expect(burger).toHaveAttribute("aria-expanded", "false");
    await expect(burger).toBeFocused();
  });

  test("clic în afară închide, focusul revine pe ☰", async ({ page }) => {
    await page.goto("/dashboard");
    const { burger, drawer } = await open(page);
    await page.mouse.click(375, 420); // right of the panel, on the backdrop
    await expect(drawer).not.toBeInViewport();
    await expect(burger).toBeFocused();
  });

  test("alegerea unei intrări navighează, închide, focusul revine pe ☰", async ({ page }) => {
    await page.goto("/dashboard");
    const { drawer } = await open(page);
    await drawer.getByRole("link", { name: "Setări", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/setari$/);
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await expect(drawer).not.toBeInViewport();
    await expect(page.getByRole("button", { name: "Deschide meniul" })).toBeFocused();
  });

  test("Tab rămâne în sertar, Enter deschide intrarea", async ({ page }) => {
    await page.goto("/dashboard");
    const { drawer } = await open(page);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const inside = await drawer.evaluate((d) => d.contains(document.activeElement));
      expect(inside, `focus left the drawer after ${i + 1} Tab`).toBe(true);
    }
    await drawer.getByRole("link", { name: "Proprietăți", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/dashboard\/proprietati$/);
  });
});
