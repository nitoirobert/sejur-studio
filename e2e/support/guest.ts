import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import path from "node:path";
import { AUTH_COOKIE, OUT_DIR, admin, type AxeResult, encodeSessionCookie, passwordSession } from "./helpers";
import { OWNER1_UNITS, addDays, bucharestToday, freeRange } from "./chart";

// Brief 07: helpers for the public booking request, the guest account and the host requests.

// A fresh visitor: no session, but the cookie-consent choice (playwright.config.ts writes it).
export const GUEST_STATE = path.join(OUT_DIR, "consent-state.json");

export const RL_BUCKET = "public_booking";
export const GUEST_PASSWORD = "Parola-Oaspete-123";
export const PHONE = "+40 712 345 678";

// A unique client IP per context (x-vercel-forwarded-for is the first header clientIp() reads), so the
// IP limit (5 / hour, rate_limit_hit) of one test never spends the budget of another.
const octet = () => 1 + Math.floor(Math.random() * 250);
export const uniqueIp = () => `10.${octet()}.${octet()}.${octet()}`;
export async function useIp(page: Page | BrowserContext, ip = uniqueIp()) {
  await page.setExtraHTTPHeaders({ "x-vercel-forwarded-for": ip });
  return ip;
}

// Best effort: on the dev DB the admin key gets 42501 on DELETE from rate_limit_hits, contrary to
// docs/DB.md "Resetare în teste". The specs do not depend on it: every context gets a unique IP.
export async function resetRateLimit(): Promise<string | null> {
  const { error } = await admin().from("rate_limit_hits").delete().eq("bucket", RL_BUCKET);
  return error ? `${error.code} ${error.message}` : null;
}

// Published seed units of owner1 that have a base price (public_quote ok on a free range).
export async function pricedUnits(): Promise<{ id: string; max: number }[]> {
  const { data, error } = await admin()
    .from("units")
    .select("id, max_guests, is_published, unit_prices(kind, price_per_night)")
    .in("id", OWNER1_UNITS)
    .eq("is_published", true);
  if (error) throw error;
  return (data ?? [])
    .filter((u) => (u.unit_prices as { kind: string; price_per_night: number }[]).some((p) => p.kind === "base" && p.price_per_night > 0))
    .map((u) => ({ id: u.id as string, max: u.max_guests as number }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

// A free 2-night stay starting at today + offset (never fixed dates).
export async function freeStay(unit: string, offset = 30, nights = 2) {
  const from = await freeRange(unit, addDays(await bucharestToday(), offset), nights);
  return { from, to: addDays(from, nights) };
}

export async function quote(unit: string, from: string, to: string, adults = 2, children = 0) {
  const { data, error } = await admin()
    .rpc("public_quote", { p_unit_id: unit, p_check_in: from, p_check_out: to, p_adults: adults, p_children: children })
    .single();
  if (error) throw error;
  return data as { ok: boolean; reason: string | null; total: number; nightly: Record<string, number>; nights: number };
}

// The BookingCard form on /cazare/[id] (the dashboard chart form has its own testids).
export const card = (page: Page): Locator => page.locator("form").filter({ has: page.locator('input[name="checkIn"]') });
export const continueBtn = (page: Page) => card(page).getByRole("button", { name: "Rezervă această cazare" });
export const sendBtn = (page: Page) => card(page).getByRole("button", { name: /Trimite cererea|Se trimite/ });
export const cardError = (page: Page) => card(page).getByTestId("booking-error");

export async function openUnit(page: Page, unit: string) {
  await page.goto(`/cazare/${unit}`);
  await expect(card(page)).toBeVisible();
}

export async function setStay(page: Page, from: string, to: string) {
  const f = card(page);
  await f.locator('input[name="checkIn"]').fill(from);
  await f.locator('input[name="checkOut"]').fill(to);
}

export async function fillContact(page: Page, c: { name: string; email: string; phone?: string }) {
  const f = card(page);
  await f.locator('input[name="fullName"]').fill(c.name);
  await f.locator('input[name="email"]').fill(c.email);
  await f.locator('input[name="phone"]').fill(c.phone ?? PHONE);
}

// Full request through the UI; returns the status-page token.
export async function requestViaUi(page: Page, unit: string, stay: { from: string; to: string }, c: { name: string; email: string }) {
  await openUnit(page, unit);
  await setStay(page, stay.from, stay.to);
  await expect(continueBtn(page)).toBeEnabled();
  await continueBtn(page).click();
  await fillContact(page, c);
  await sendBtn(page).click();
  await page.waitForURL(/\/rezervare\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop()!;
}

export async function bookingByToken(token: string) {
  const { data, error } = await admin()
    .from("bookings")
    .select("id, status, total_amount, user_id, check_in, check_out, unit_id, hold_expires_at")
    .eq("public_token", token)
    .single();
  if (error) throw error;
  return data;
}

// Guest account created with the admin key (email confirmed), signed in once against GoTrue.
export async function createGuest(email: string, fullName: string) {
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: GUEST_PASSWORD,
    email_confirm: true,
    user_metadata: { account_type: "guest", full_name: fullName },
  });
  if (error) throw error;
  const session = await passwordSession(email, GUEST_PASSWORD);
  return { id: data.user.id, session };
}

// Puts a session into the @supabase/ssr cookie (chunked above 3180 chars, like the library).
export async function signInContext(context: BrowserContext, baseURL: string, session: object) {
  const value = encodeSessionCookie(session);
  const name = AUTH_COOKIE();
  const chunks = value.length <= 3180 ? [[name, value]] : value.match(/.{1,3180}/g)!.map((v, i) => [`${name}.${i}`, v]);
  await context.addCookies(chunks.map(([n, v]) => ({ name: n, value: v, url: baseURL })));
}

// Romanian, no technical text, comma-below letters.
export function cleanRo(text: string) {
  expect(text).not.toMatch(/unavailable|P0001|P0002|23P01|22023|error|null|undefined|too_many|invalid_/i);
  expect(text).not.toMatch(/[ŞşŢţ]/);
}

// axe violations as "rule: selector" lines (first 6 nodes per rule), for readable failures.
export const axeList = (r: AxeResult) =>
  r.violations.flatMap((v) => v.nodes.slice(0, 6).map((n) => `${v.id}: ${(n.target as string[]).join(" ")}`));
