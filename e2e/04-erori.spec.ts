import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { AuthApiError } from "@supabase/supabase-js";
import { authErrorKey } from "../src/lib/supabase/errors";
import { SEED, uniqueEmail } from "./support/helpers";

// Check 4: Romanian errors, fixed here word for word ("într‑un" uses a non-breaking hyphen, as in ro.json). Raw Supabase / Postgres text never shows.
const TEXT = {
  invalid: "Email sau parolă greșită",
  taken: "Există deja un cont cu acest email. Intră în cont sau folosește alt email.",
  short: "Parola trebuie să aibă cel puțin 8 caractere",
  nameEmpty: "Scrie-ți numele",
  rateLimit: "Prea multe încercări într‑un timp scurt. Așteaptă câteva minute și încearcă din nou.",
};
const RAW = /Invalid login credentials|User already registered|already been registered|Password should|AuthApiError|AuthError|duplicate key|violates|PGRST|weak_password|user_already_exists|over_request_rate_limit|email_address_invalid|rate limit/i;

// The form error (Next also renders an empty route-announcer with role=alert).
const formAlert = (page: Page) => page.locator("form [role=alert]");

async function expectClean(page: Page) {
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(RAW);
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Parolă", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Intră în cont" }).click();
}

async function signup(page: Page, name: string, email: string, password: string) {
  await page.goto("/cont-nou");
  await page.getByLabel("Nume complet").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Parolă", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Creează contul" }).click();
}

test.describe("login", () => {
  test("parolă greșită -> un singur text; parola se golește", async ({ page }) => {
    await login(page, SEED.owner1.email, "Parola-Gresita-999");
    await expect(formAlert(page)).toHaveText(TEXT.invalid);
    await expect(page.getByLabel("Parolă", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Email")).toHaveValue(SEED.owner1.email);
    await expect(page).toHaveURL(/\/login/);
    await expectClean(page);
  });

  test("email necunoscut -> același text", async ({ page }) => {
    await login(page, "nimeni-e2e@example.com", "Parola-Test-123");
    await expect(formAlert(page)).toHaveText(TEXT.invalid);
    await expectClean(page);
  });

  test("email invalid -> același text (fără apel la Auth)", async ({ page }) => {
    await login(page, "nu-e-email", "x");
    await expect(formAlert(page)).toHaveText(TEXT.invalid);
    await expectClean(page);
  });
});

test.describe("cont nou", () => {
  test("email folosit", async ({ page }) => {
    await signup(page, "Test Folosit", SEED.owner1.email, "Parola-Noua-123");
    await expect(formAlert(page)).toHaveText(TEXT.taken);
    await expect(page).toHaveURL(/\/cont-nou/);
    await expectClean(page);
  });

  test("parolă scurtă (7 caractere)", async ({ page }) => {
    await signup(page, "Test Scurt", uniqueEmail(), "Abc-123");
    await expect(page.getByText(TEXT.short)).toBeVisible();
    await expect(page.getByLabel("Parolă", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expectClean(page);
  });

  test("nume gol (doar spații)", async ({ page }) => {
    await signup(page, "    ", uniqueEmail(), "Parola-Noua-123");
    await expect(page.getByText(TEXT.nameEmpty)).toBeVisible();
    await expect(page.getByLabel("Nume complet")).toHaveAttribute("aria-invalid", "true");
    await expectClean(page);
  });
});

// The cloud limit is 30 sign-ins / 5 min per IP and the rest of the suite needs ~8 of them, so the
// 429 path is not provoked live. It is checked on the mapping the actions use instead.
test.describe("429 -> mesaj în română (fără a epuiza limita)", () => {
  test("authErrorKey mapează 429 / over_* la rateLimit, pentru login și cont nou", () => {
    const cases = [
      new AuthApiError("Request rate limit reached", 429, "over_request_rate_limit"),
      new AuthApiError("Email rate limit exceeded", 429, "over_email_send_rate_limit"),
      new AuthApiError("too many", 429, undefined),
    ];
    for (const err of cases) {
      expect(authErrorKey(err, "login")).toBe("rateLimit");
      expect(authErrorKey(err, "signup")).toBe("rateLimit");
    }
    expect(authErrorKey(new AuthApiError("Invalid login credentials", 400, "invalid_credentials"), "login")).toBe(
      "invalidCredentials",
    );
    expect(authErrorKey(new AuthApiError("User already registered", 422, "user_already_exists"), "signup")).toBe(
      "emailTaken",
    );
  });

  test("textul rateLimit din ro.json e cel fixat", () => {
    const ro = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", "ro.json"), "utf8"));
    expect(ro.Dashboard.errors.rateLimit).toBe(TEXT.rateLimit);
    expect(ro.Dashboard.errors.invalidCredentials).toBe(TEXT.invalid);
  });
});
