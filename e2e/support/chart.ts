import { expect, type Locator, type Page } from "@playwright/test";
import { admin, asUser } from "./helpers";

// Brief 03 selectors in ONE place. Draft names until web-03 sends the contract; update here only.
export const SEL = {
  chart: '[data-testid="booking-chart"]', // data-from, data-days, data-today
  scroller: '[data-testid="chart-scroll"]',
  day: '[data-testid="chart-day"]', // data-date; aria-current="date" on today
  todayLine: '[data-testid="chart-today-line"]', // data-date, one per unit row
  cell: '[data-testid="chart-cell"]', // data-unit-id, data-date, data-free
  bar: '[data-testid="chart-bar"]', // data-booking-id, data-unit-id, data-status, data-from, data-to (exclusive)
  row: '[data-testid="chart-row"]', // data-unit-id
  selection: '[data-testid="chart-selection"]',
  sheet: '[data-testid="booking-sheet"]',
  form: '[data-testid="booking-form"]',
  panel: '[data-testid="booking-details"]',
  formError: '[data-testid="booking-error"]', // data-code
  prev: '[data-testid="chart-prev"]',
  next: '[data-testid="chart-next"]',
  todayLink: '[data-testid="chart-today"]',
  view: (n: number) => `[data-testid="chart-days-${n}"]`,
  property: '[data-testid="chart-property-filter"]',
};

// URL params (check 6).
export const P = { from: "de", days: "zile", property: "proprietate" } as const;

// messages/ro.json Dashboard.booking.errors.* (the error element also carries data-code).
export const ERR = {
  booking_overlap: "Unitatea are deja o rezervare în aceste zile. Alege alte zile.",
  invalid_dates: "Alege o plecare după sosire, cel mult 366 de nopți.",
  invalid_guest: "Verifică oaspetele: un nume de cel mult 80 de caractere, cel puțin un adult, emailul și telefonul.",
  invalid_amount: "Scrie suma în lei, de exemplu 450,50: fără minus, cu cel mult două zecimale.",
  unit_not_found: "Unitatea nu există în contul tău.",
  generic: "Nu am putut salva rezervarea. Datele au rămas în formular; încearcă din nou.",
} as const;
export type ErrCode = keyof typeof ERR;

export async function expectError(page: Page, code: ErrCode) {
  const e = page.locator(SEL.formError);
  await expect(e).toHaveAttribute("data-code", code);
  await expect(e).toHaveText(ERR[code]);
}

export const OWNER1_UNITS = [1, 2, 3, 4, 5, 6].map((n) => `b1000000-0000-4000-8000-00000000000${n}`);
export const OWNER1_PROPS = ["a1000000-0000-4000-8000-000000000001", "a1000000-0000-4000-8000-000000000002"];
export const OWNER2_UNIT = "b2000000-0000-4000-8000-000000000001";
export const OWNER2_PROP = "a2000000-0000-4000-8000-000000000001";

// Every booking created by the e2e suite has a guest whose name starts with this prefix;
// cleanup.teardown.ts deletes them (and their guests) with the admin key.
export const GUEST_PREFIX = "E2E ";

// Date math on "YYYY-MM-DD" strings in UTC only (never +86400000 on local time).
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  const t = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((t(b) - t(a)) / 86_400_000);
}

export async function bucharestToday(): Promise<string> {
  const { data, error } = await admin().rpc("bucharest_today");
  if (error) throw error;
  return String(data);
}

export type ChartRow = {
  booking_id: string;
  unit_id: string;
  property_id: string;
  check_in: string;
  check_out: string;
  status: string;
  source: string;
  guest_name: string | null;
};

export async function chartRows(token: string, from: string, to: string, property: string | null = null) {
  const { data, error } = await asUser(token).rpc("dashboard_chart", {
    p_from: from,
    p_to: to,
    p_property_id: property,
  });
  return { rows: (data ?? []) as ChartRow[], error };
}

// First start date >= `from` where `unit` has no booking row at all for `nights` nights (+1 day margin).
export async function freeRange(unit: string, from: string, nights: number): Promise<string> {
  const { data, error } = await admin()
    .from("bookings")
    .select("check_in, check_out, status")
    .eq("unit_id", unit)
    .gte("check_out", addDays(from, -1))
    .order("check_in");
  if (error) throw error;
  let start = from;
  for (;;) {
    const end = addDays(start, nights);
    const clash = (data ?? []).find((b) => b.check_in < addDays(end, 1) && b.check_out > addDays(start, -1));
    if (!clash) return start;
    start = addDays(clash.check_out as string, 1);
  }
}

export async function bookingsFor(unit: string, from: string, to: string) {
  const { data, error } = await admin()
    .from("bookings")
    .select("id, check_in, check_out, status, source, organization_id, adults, children, total_amount, guest_id, guests(full_name)")
    .eq("unit_id", unit)
    .lt("check_in", to)
    .gt("check_out", from)
    .in("status", ["confirmed", "blocked", "hold"]);
  if (error) throw error;
  return data ?? [];
}

// Admin insert for edge cases (hold active/expired, window-crossing booking). Prefixed guest.
export async function insertBooking(o: {
  org: string;
  unit: string;
  check_in: string;
  check_out: string;
  status: "confirmed" | "hold" | "blocked";
  hold_expires_at?: string;
  name: string;
}) {
  const db = admin();
  const { data: g, error: ge } = await db
    .from("guests")
    .insert({ organization_id: o.org, full_name: GUEST_PREFIX + o.name })
    .select("id")
    .single();
  if (ge) throw ge;
  const { data, error } = await db
    .from("bookings")
    .insert({
      organization_id: o.org,
      unit_id: o.unit,
      guest_id: g.id,
      check_in: o.check_in,
      check_out: o.check_out,
      status: o.status,
      source: "direct",
      adults: 2,
      children: 0,
      total_amount: 10000,
      hold_expires_at: o.hold_expires_at ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function orgOfUnit(unit: string): Promise<string> {
  const { data, error } = await admin().from("units").select("organization_id").eq("id", unit).single();
  if (error) throw error;
  return data.organization_id as string;
}

// Deletes every booking whose guest name starts with GUEST_PREFIX, then those guests.
export async function deleteE2EBookings(): Promise<number> {
  const db = admin();
  const { data: guests, error } = await db.from("guests").select("id").like("full_name", `${GUEST_PREFIX}%`);
  if (error) throw error;
  const ids = (guests ?? []).map((g) => g.id as string);
  if (!ids.length) return 0;
  const { error: be } = await db.from("bookings").delete().in("guest_id", ids);
  if (be) throw be;
  const { error: ge } = await db.from("guests").delete().in("id", ids);
  if (ge) throw ge;
  return ids.length;
}

export const chartUrl = (from?: string, days?: number, property?: string) => {
  const q = new URLSearchParams();
  if (from) q.set(P.from, from);
  if (days) q.set(P.days, String(days));
  if (property) q.set(P.property, property);
  const s = q.toString();
  return `/dashboard${s ? `?${s}` : ""}`;
};

export async function gotoChart(page: Page, from?: string, days?: number, property?: string) {
  await page.goto(chartUrl(from, days, property));
  await expect(page.locator(SEL.chart)).toBeVisible();
}

export const cell = (page: Page, unit: string, date: string): Locator =>
  page.locator(`${SEL.cell}[data-unit-id="${unit}"][data-date="${date}"]`);

// Click-and-drag from the first to the last selected night (inclusive), with real mouse steps.
export async function dragSelect(page: Page, unit: string, first: string, last: string, steps = 8) {
  const a = cell(page, unit, first);
  const b = cell(page, unit, last);
  await a.scrollIntoViewIfNeeded();
  const ba = (await a.boundingBox())!;
  const bb = (await b.boundingBox())!;
  await page.mouse.move(ba.x + ba.width / 2, ba.y + ba.height / 2);
  await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps });
  await page.mouse.up();
}

export async function fillForm(
  page: Page,
  v: { name?: string; email?: string; phone?: string; adults?: string; children?: string; amount?: string },
) {
  const f = page.locator(SEL.form);
  await expect(f).toBeVisible();
  const map: [keyof typeof v, string][] = [
    ["name", "booking-name"], ["email", "booking-email"], ["phone", "booking-phone"],
    ["adults", "booking-adults"], ["children", "booking-children"], ["amount", "booking-amount"],
  ];
  for (const [k, id] of map) if (v[k] !== undefined) await f.getByTestId(id).fill(v[k]!);
}

export const field = (page: Page, id: string) => page.locator(SEL.form).getByTestId(`booking-${id}`);
export const submitButton = (page: Page) => page.getByTestId("booking-submit");
