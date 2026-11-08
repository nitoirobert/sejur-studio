import fs from "node:fs";
import path from "node:path";
import { expect, test, type APIRequest, type Page } from "@playwright/test";
import { PASSWORD_MIN } from "../src/lib/supabase/validation";
import { OWNER1_STATE, uniqueEmail } from "./support/helpers";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const walkTs = (dir: string): string[] =>
  fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walkTs(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : [],
  );
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

// Check 10: every action and /dashboard page checks the user on the server; org from the session.
test("zod: minimul parolei = config.toml = PASSWORD_MIN", () => {
  const toml = read("supabase/config.toml");
  const m = toml.match(/^\s*minimum_password_length\s*=\s*(\d+)/m);
  expect(Number(m![1])).toBe(PASSWORD_MIN);
});

test("cod: paginile /dashboard trec prin requireViewer; nicio acțiune nu citește organizația din formular", () => {
  const files = ["src/app/login/actions.ts", "src/app/cont-nou/actions.ts", "src/app/dashboard/actions.ts"];
  for (const f of files) expect(code(f), f).not.toMatch(/organization/i);
  expect(read("src/components/dashboard/DashboardPage.tsx")).toMatch(/await requireViewer\(\)/);
  expect(read("src/components/dashboard/KpiCards.tsx")).toMatch(/await requireViewer\(\)/);
  for (const p of ["proprietati", "rezervari", "setari"]) {
    expect(read(`src/app/dashboard/${p}/page.tsx`), p).toMatch(/DashboardPage/);
  }
});

async function signup(page: Page, name: string, email: string, password: string) {
  await page.goto("/cont-nou");
  // The input caps at 80 (maxLength); drop the cap so the server-side zod check is what answers.
  await page.getByLabel("Nume complet").evaluate((el) => el.removeAttribute("maxlength"));
  await page.getByLabel("Nume complet").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Parolă", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Creează contul" }).click();
}

test("zod pe server: nume de 81 de caractere refuzat", async ({ page }) => {
  await signup(page, "A".repeat(81), uniqueEmail(), "Parola-Noua-123");
  await expect(page.getByText("Numele poate avea cel mult 80 de caractere")).toBeVisible();
  await expect(page).toHaveURL(/\/cont-nou/);
});

test("zod pe server: email invalid refuzat", async ({ page }) => {
  await signup(page, "Test Email", "nu-e-email", "Parola-Noua-123");
  await expect(page.getByText("Scrie un email valid, de forma nume@exemplu.ro")).toBeVisible();
});

test.describe("acțiune apelată fără cookie", () => {
  // The sign-out action id, read from the dashboard HTML with owner1's session. No skip: a missing id fails.
  async function signOutActionId(api: APIRequest, baseURL: string | undefined) {
    const ctx = await api.newContext({ baseURL, storageState: OWNER1_STATE });
    const html = await (await ctx.get("/dashboard")).text();
    await ctx.dispose();
    const id = html.match(/name="\$ACTION_ID_([0-9a-f]+)"/)?.[1] ?? "";
    expect(id, "sign-out action id in /dashboard HTML").toMatch(/^[0-9a-f]{20,}$/);
    return id;
  }

  async function postAction(api: APIRequest, baseURL: string | undefined, route: string, id: string) {
    const ctx = await api.newContext({ baseURL });
    const res = await ctx.post(route, {
      headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
      data: "[]",
      maxRedirects: 0,
    });
    const out = { status: res.status(), headers: res.headers(), body: await res.text() };
    await ctx.dispose();
    return out;
  }

  // This one stops at the proxy (no session on /dashboard/*), before the action runs.
  test("proxy: POST /dashboard cu Next-Action, fără cookie -> /login, fără date", async ({ playwright, baseURL }) => {
    const id = await signOutActionId(playwright.request, baseURL);
    const res = await postAction(playwright.request, baseURL, "/dashboard", id);
    expect([303, 307, 308]).toContain(res.status);
    expect(res.headers["location"]).toMatch(/\/login/);
    expect(res.body).not.toMatch(/kpi-|Sosiri azi|dashboard_kpis/);
  });

  // /login is not gated by the proxy for anonymous users. Next finds the action there (no 409
  // "action not found") but answers from the prerendered /login with `{}`: the HTTP answer is the
  // same with or without the auth check, so this proves only "no data, no session"; the auth check
  // itself is asserted on the code in the next test.
  test("acțiunea de ieșire trimisă la /login fără cookie -> găsită, fără date, fără cookie de sesiune", async ({
    playwright,
    baseURL,
  }) => {
    const id = await signOutActionId(playwright.request, baseURL);
    const res = await postAction(playwright.request, baseURL, "/login", id);
    expect(res.status, res.body.slice(0, 300)).toBeLessThan(500);
    expect(res.status, "action id must be known to the server").not.toBe(409);
    expect(res.headers["x-nextjs-action-not-found"] ?? "").toBe("");
    expect(res.body).not.toMatch(/kpi-|Sosiri azi|arrivals_today|revenue_month/);
    expect(res.headers["set-cookie"] ?? "").not.toMatch(/sb-[^=]+-auth-token=base64-/);
  });

  // Over HTTP a sign-out without a session looks the same with or without the check, so the
  // "every action checks the user first" rule is asserted on the code: each exported function
  // in a "use server" file of the dashboard calls requireViewer() before anything else touches Supabase.
  test("cod: fiecare server action din /dashboard cheamă requireViewer() înainte de createClient()", () => {
    const files = walkTs("src/app/dashboard").concat(walkTs("src/components/dashboard"));
    const actions: string[] = [];
    for (const f of files) {
      const src = code(f);
      if (!/^\s*["']use server["']/.test(src)) continue;
      for (const m of src.matchAll(/export\s+(?:default\s+)?async\s+function\s+(\w+)\s*\([^)]*\)[^{]*\{/g)) {
        let depth = 1;
        let i = m.index! + m[0].length;
        const start = i;
        for (; i < src.length && depth > 0; i++) {
          if (src[i] === "{") depth++;
          else if (src[i] === "}") depth--;
        }
        const body = src.slice(start, i);
        const auth = body.indexOf("await requireViewer()");
        const supa = body.search(/createClient\(|supabase\./);
        actions.push(m[1]);
        expect(auth, `${f} ${m[1]}: no await requireViewer()`).toBeGreaterThanOrEqual(0);
        if (supa >= 0) expect(auth, `${f} ${m[1]}: requireViewer() after Supabase`).toBeLessThan(supa);
      }
    }
    expect(actions, "server actions found").toContain("signOut");
  });
});
