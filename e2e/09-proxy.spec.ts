import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  AUTH_COOKIE,
  SEED,
  encodeSessionCookie,
  passwordSession,
  sessionFromCookies,
} from "./support/helpers";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

// Check 9: proxy refreshes with getClaims()/getUser(), never decides on getSession().
test("cod: getClaims/getUser în proxy și DAL, niciun getSession()", () => {
  const proxy = code("src/lib/supabase/proxy.ts");
  expect(proxy).toMatch(/auth\.(getClaims|getUser)\(/);
  expect(proxy).toMatch(/response\.cookies\.set\(/);
  for (const f of ["src/proxy.ts", "src/lib/supabase/proxy.ts", "src/lib/supabase/dal.ts", "src/lib/supabase/server.ts"]) {
    expect(code(f), f).not.toMatch(/getSession\s*\(/);
  }
});

test("matcher: exclude _next/static, _next/image, imagini și fișiere publice", async () => {
  const src = read("src/proxy.ts");
  const m = src.match(/matcher:\s*\[\s*"([^"]+)"/);
  expect(m).toBeTruthy();
  // Next matcher syntax "/(...)" is a path-to-regexp group; as a plain RegExp it is equivalent here.
  const re = new RegExp(`^${m![1].replace(/\\\\/g, "\\")}$`);
  for (const p of ["/_next/static/chunks/a.js", "/_next/image", "/logo.png", "/fundal.jpg", "/video.mp4", "/maplibre-gl-worker.mjs", "/favicon.ico"]) {
    expect(re.test(p), `${p} excluded`).toBe(false);
  }
  for (const p of ["/dashboard", "/dashboard/setari", "/login", "/cont-nou"]) {
    expect(re.test(p), `${p} matched`).toBe(true);
  }
});

const forged = () =>
  encodeSessionCookie({
    access_token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJleHAiOjQxMDI0NDQ4MDB9.forged",
    refresh_token: "forged-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 4102444800,
    user: { id: "00000000-0000-0000-0000-000000000000" },
  });

test("/ și fișierele publice: fără redirect, fără cookie scris, chiar cu cookie falsificat", async ({ request }) => {
  const headers = { cookie: `${AUTH_COOKIE()}=${forged()}` };
  for (const p of ["/", "/logo.png"]) {
    const res = await request.get(p, { headers, maxRedirects: 0 });
    expect(res.status(), p).toBe(200);
    expect(res.headers()["set-cookie"], p).toBeUndefined();
  }
});

test("cookie falsificat -> /login, fără KPI", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: AUTH_COOKIE(), value: forged(), url: baseURL! }]);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  expect(await page.content()).not.toContain("kpi-revenue-value");
});

test("token expirat + refresh valid -> panoul se deschide fără login, cookie nou", async ({ page, context, baseURL }) => {
  const s = await passwordSession(SEED.owner1.email, SEED.password);
  const [h, payload] = s.access_token.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  const past = Math.floor(Date.now() / 1000) - 120;
  const expiredToken = `${h}.${Buffer.from(JSON.stringify({ ...claims, exp: past })).toString("base64url")}.expired`;
  await context.addCookies([
    {
      name: AUTH_COOKIE(),
      value: encodeSessionCookie({ ...s, access_token: expiredToken, expires_at: past }),
      url: baseURL!,
    },
  ]);
  const responses: { url: string; setCookie: boolean }[] = [];
  page.on("response", async (r) => {
    if (r.url().startsWith(baseURL!)) responses.push({ url: r.url(), setCookie: Boolean((await r.allHeaders())["set-cookie"]) });
  });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("kpi-revenue-value")).toBeVisible();
  await expect(page.getByTestId("greeting")).toHaveText("Bună, Ana");
  const refreshed = sessionFromCookies(await context.cookies());
  expect(refreshed.access_token).not.toBe(expiredToken);
  expect(refreshed.refresh_token).not.toBe(s.refresh_token);
  expect(responses.find((r) => new URL(r.url).pathname === "/dashboard")?.setCookie).toBe(true);
});
