import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadTestEnv, need } from "./env";

loadTestEnv();

export const OUT_DIR = process.env.E2E_OUT_DIR ?? path.join(os.tmpdir(), "sejur-e2e");
export const AUTH_DIR = path.join(OUT_DIR, "auth");
export const OWNER1_STATE = path.join(AUTH_DIR, "owner1.json");
export const OWNER2_STATE = path.join(AUTH_DIR, "owner2.json");
export const NEW_USER_STATE = path.join(AUTH_DIR, "new-user.json");
export const NEW_USER_FILE = path.join(AUTH_DIR, "new-user-meta.json");
export const SEED_SNAPSHOT = path.join(AUTH_DIR, "seed-snapshot.json");
export const SHOTS_DIR = path.join(process.cwd(), "docs", "briefs", "02-capturi");

export const SEED = {
  owner1: { email: "owner1@example.com", name: "Ana" },
  owner2: { email: "owner2@example.com", name: "Mihai" },
  password: "Parola-Test-123",
};

export const SUPABASE_URL = () => need("NEXT_PUBLIC_SUPABASE_URL");
export const ANON_KEY = () => need("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const projectRef = () => new URL(SUPABASE_URL()).hostname.split(".")[0];
export const AUTH_COOKIE = () => `sb-${projectRef()}-auth-token`;

// Admin client: e2e only, key from .env.test.local. Bypasses RLS; used for DB asserts and cleanup.
export function admin(): SupabaseClient {
  return createClient(SUPABASE_URL(), need("SUPABASE_ADMIN_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// A client acting as the user behind an access token (RLS applies).
export function asUser(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL(), ANON_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export type StoredSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user?: { id: string };
};

// @supabase/ssr cookie: "base64-" + base64url(JSON), split into .0/.1 chunks above 3180 chars.
export function sessionFromCookies(cookies: { name: string; value: string }[]): StoredSession {
  const base = AUTH_COOKIE();
  const whole = cookies.find((c) => c.name === base);
  const chunks = cookies
    .filter((c) => c.name.startsWith(`${base}.`))
    .sort((a, b) => Number(a.name.split(".").pop()) - Number(b.name.split(".").pop()));
  let raw = whole ? whole.value : chunks.map((c) => c.value).join("");
  if (!raw) throw new Error("no auth cookie");
  if (raw.startsWith("base64-")) raw = Buffer.from(raw.slice(7), "base64url").toString("utf8");
  return JSON.parse(raw) as StoredSession;
}

export function encodeSessionCookie(session: object): string {
  return "base64-" + Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

export function sessionFromStateFile(file: string): StoredSession {
  const state = JSON.parse(fs.readFileSync(file, "utf8")) as { cookies: { name: string; value: string }[] };
  return sessionFromCookies(state.cookies);
}

// Password sign-in straight against GoTrue (counts against the auth rate limit: use sparingly).
export async function passwordSession(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL()}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY(), "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`sign-in ${email}: ${res.status} ${await res.text()}`);
  return (await res.json()) as StoredSession & { user: { id: string }; expires_in: number; token_type: string };
}

const ro = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 });
// Revenue: whole amounts without decimals (8.080), otherwise exactly 2 (8.080,50); the unit comes
// from row.currency (RON -> "lei", any other code -> its Intl symbol, as in the card).
const roWhole = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
const roMoney = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function unitFor(code: string) {
  if (code === "RON") return "lei";
  const part = new Intl.NumberFormat("ro-RO", { style: "currency", currency: code }).formatToParts(0);
  return part.find((p) => p.type === "currency")?.value ?? code;
}
export const formatLei = (bani: number, currency = "RON") =>
  `${bani % 100 === 0 ? roWhole.format(bani / 100) : roMoney.format(bani / 100)} ${unitFor(currency)}`;
export const NBSP = "\u00a0";

export type Kpis = { arrivals: string; departures: string; occupancy: string; revenue: string };
export type KpiRow = {
  arrivals_today: number;
  departures_today: number;
  occupancy_pct: number | string;
  revenue_month: number | string;
  currency?: string | null;
};

// Expected card texts from a dashboard_kpis() row, formatted the Romanian way.
export function formatKpis(row: KpiRow): Kpis {
  return {
    arrivals: ro.format(row.arrivals_today),
    departures: ro.format(row.departures_today),
    // Brief 03 handover item 10: occupancy is a whole number everywhere.
    occupancy: `${ro.format(Math.round(Number(row.occupancy_pct)))}%`,
    revenue: formatLei(Number(row.revenue_month), row.currency ?? "RON"),
  };
}

export async function kpisFor(accessToken: string): Promise<KpiRow> {
  const { data, error } = await asUser(accessToken).rpc("dashboard_kpis");
  if (error) throw new Error(`dashboard_kpis: ${error.message}`);
  return (data as KpiRow[])[0];
}

export async function readKpis(page: Page): Promise<Kpis> {
  await expect(page.getByTestId("kpi-revenue-value")).toBeVisible();
  const text = async (k: string) => (await page.getByTestId(`kpi-${k}-value`).textContent())?.trim() ?? "";
  return {
    arrivals: await text("arrivals"),
    departures: await text("departures"),
    occupancy: await text("occupancy"),
    revenue: (await text("revenue")).replace(/ /g, NBSP),
  };
}

// Collects console errors and uncaught page errors for the "consola curată" checks.
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

export async function setTheme(context: BrowserContext, theme: "light" | "dark") {
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("sejur.theme", t);
    } catch {
      // storage blocked: the page falls back to its default theme
    }
  }, theme);
}

export async function noHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(sw, `scrollWidth ${sw} > clientWidth ${cw}`).toBeLessThanOrEqual(cw);
}

// Cedilla letters (ş ţ Ş Ţ) instead of comma-below (ș ț Ș Ț).
export async function noCedilla(page: Page) {
  const text = await page.evaluate(() => document.body.innerText + " " + document.title);
  expect(text.match(/[\u015e\u015f\u0162\u0163]/g) ?? []).toEqual([]);
}

const AXE_PATH = process.env.E2E_AXE_PATH ?? "C:/tmp/axe/node_modules/axe-core/axe.min.js";

export type AxeViolation = {
  id: string;
  impact: string | null;
  help: string;
  nodes: { target: unknown[]; failureSummary?: string }[];
};
export type AxeResult = {
  violations: AxeViolation[];
  incomplete: { id: string; count: number }[];
  // color-contrast nodes axe could not decide (glass, photo or gradient behind the text).
  contrastIncomplete: { target: string; reason: string }[];
};

// axe-core injected from outside the repo (no new dependency); WCAG 2.x A + AA.
export async function axeAA(page: Page): Promise<AxeResult> {
  if (!fs.existsSync(AXE_PATH)) throw new Error(`axe-core not found at ${AXE_PATH} (set E2E_AXE_PATH)`);
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async () => {
    type Raw = {
      violations: AxeViolation[];
      incomplete: { id: string; nodes: { target: string[]; any?: { data?: { messageKey?: string } | null }[] }[] }[];
    };
    const w = window as unknown as { axe: { run: (ctx: Document, opts: object) => Promise<Raw> } };
    const r = await w.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    });
    return {
      violations: r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.map((n) => ({ target: n.target, failureSummary: n.failureSummary })),
      })),
      incomplete: r.incomplete.map((v) => ({ id: v.id, count: v.nodes.length })),
      contrastIncomplete: r.incomplete
        .filter((v) => v.id === "color-contrast")
        .flatMap((v) => v.nodes.map((n) => ({ target: String(n.target[0]), reason: n.any?.[0]?.data?.messageKey ?? "" }))),
    };
  });
}

// Real check for the color-contrast nodes axe leaves "incomplete": hide the text, screenshot the
// element, and measure the text colour against every background pixel under the text boxes.
// Pass = the worst 1 % of those pixels still reach 4.5:1 (3:1 for large text, WCAG 1.4.3).
export async function pixelContrast(
  page: Page,
  targets: string[],
): Promise<{ failures: string[]; checked: string[]; notVisible: string[] }> {
  const failures: string[] = [];
  const checked: string[] = [];
  const notVisible: string[] = [];
  for (const sel of [...new Set(targets)]) {
    const el = page.locator(sel).first();
    if (!(await el.isVisible())) {
      notVisible.push(sel);
      continue;
    }
    await el.scrollIntoViewIfNeeded();
    const info = await el.evaluate((node) => {
      const own = [...node.childNodes].filter((n) => n.nodeType === 3 && n.textContent!.trim());
      const texts: Node[] = own.length ? own : [];
      if (!texts.length) {
        const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) if (n.textContent!.trim()) texts.push(n);
      }
      const box = node.getBoundingClientRect();
      const rects: { x: number; y: number; w: number; h: number }[] = [];
      for (const t of texts) {
        const range = document.createRange();
        range.selectNodeContents(t);
        for (const r of range.getClientRects()) {
          if (r.width < 1 || r.height < 1) continue;
          rects.push({ x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height });
        }
      }
      const holder = (texts[0]?.parentElement ?? node) as Element;
      const cs = getComputedStyle(holder);
      // Resolve any colour syntax (oklch, color-mix, ...) to sRGB through a canvas.
      const c = document.createElement("canvas").getContext("2d")!;
      c.fillStyle = cs.color;
      c.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = c.getImageData(0, 0, 1, 1).data;
      let opacity = 1;
      for (let e: Element | null = holder; e; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity);
      node.setAttribute("data-contrast-probe", "");
      const size = parseFloat(cs.fontSize);
      const weight = Number(cs.fontWeight) || 400;
      return {
        rects,
        rgb: [r, g, b],
        alpha: (a / 255) * opacity,
        large: size >= 24 || (size >= 18.66 && weight >= 700),
        size,
      };
    });
    const style = await page.addStyleTag({
      content:
        "[data-contrast-probe],[data-contrast-probe] *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important;text-decoration-color:transparent!important}",
    });
    let png: Buffer;
    try {
      png = await el.screenshot({ animations: "disabled", scale: "css" });
    } finally {
      await style.evaluate((s) => (s as Element).remove());
      await el.evaluate((n) => n.removeAttribute("data-contrast-probe"));
    }
    if (!info.rects.length) continue;
    const worst = await page.evaluate(
      async ({ b64, rects, rgb, alpha }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const cv = document.createElement("canvas");
        cv.width = img.width;
        cv.height = img.height;
        const ctx = cv.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const px = ctx.getImageData(0, 0, cv.width, cv.height).data;
        const lin = (v: number) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        const ratios: number[] = [];
        for (const r of rects) {
          for (let y = Math.max(0, Math.floor(r.y)); y < Math.min(cv.height, Math.ceil(r.y + r.h)); y++) {
            for (let x = Math.max(0, Math.floor(r.x)); x < Math.min(cv.width, Math.ceil(r.x + r.w)); x++) {
              const i = (y * cv.width + x) * 4;
              const bg = [px[i], px[i + 1], px[i + 2]];
              const fg = rgb.map((v, k) => alpha * v + (1 - alpha) * bg[k]);
              const l1 = lum(fg[0], fg[1], fg[2]);
              const l2 = lum(bg[0], bg[1], bg[2]);
              ratios.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
            }
          }
        }
        ratios.sort((p, q) => p - q);
        return ratios.length ? ratios[Math.floor(ratios.length * 0.01)] : null;
      },
      { b64: png.toString("base64"), rects: info.rects, rgb: info.rgb, alpha: info.alpha },
    );
    if (worst === null) continue;
    const need = info.large ? 3 : 4.5;
    checked.push(`${sel} ${worst.toFixed(2)}`);
    if (worst < need) failures.push(`${sel}: ${worst.toFixed(2)}:1 < ${need}:1 (${info.size}px)`);
  }
  return { failures, checked, notVisible };
}

export function uniqueEmail() {
  return `e2e+${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
}
