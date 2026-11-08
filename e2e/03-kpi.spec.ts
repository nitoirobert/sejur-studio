import { expect, test } from "@playwright/test";
import {
  OWNER1_STATE,
  OWNER2_STATE,
  admin,
  formatKpis,
  kpisFor,
  readKpis,
  sessionFromStateFile,
  watchConsole,
} from "./support/helpers";

// Revenue of the Bucharest calendar month of bucharest_today(), recomputed from public.payments
// (succeeded or partially refunded, net of refunds) of owner1's organization(s).
async function revenueFromTable(userId: string): Promise<number> {
  const db = admin();
  const { data: today, error: e1 } = await db.rpc("bucharest_today");
  if (e1) throw e1;
  const [y, m] = String(today).split("-").map(Number);
  const m0 = `${y}-${String(m).padStart(2, "0")}-01`;
  const m1 = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const { data: members, error: e2 } = await db.from("organization_members").select("organization_id").eq("user_id", userId);
  if (e2) throw e2;
  const orgIds = (members ?? []).map((x) => x.organization_id as string);
  expect(orgIds.length, "owner1 organizations").toBeGreaterThan(0);
  const { data: pays, error: e3 } = await db
    .from("payments")
    .select("amount, refunded_amount, created_at")
    .in("organization_id", orgIds)
    .in("status", ["succeeded", "partially_refunded"]);
  if (e3) throw e3;
  const day = (ts: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date(ts));
  const sum = (pays ?? [])
    .filter((p) => day(p.created_at as string) >= m0 && day(p.created_at as string) < m1)
    .reduce((acc, p) => acc + Number(p.amount) - Number(p.refunded_amount ?? 0), 0);
  expect(sum, "owner1 has paid revenue this month (seed)").toBeGreaterThan(0);
  return sum;
}

// "8.080 lei" / "8.080,50 lei" without Intl, so it does not share code with the card or formatLei().
function handFormatLei(bani: number): string {
  const whole = Math.floor(bani / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cents = bani % 100;
  return `${cents ? `${whole},${String(cents).padStart(2, "0")}` : whole} lei`;
}

// Check 3: the cards show dashboard_kpis() of the signed-in owner, formatted ro-RO.
// (The "cont nou 0 / 0 / 0% / 0 lei" part runs in 01-cont-nou.spec.ts, right after sign-up.)
test.describe("owner1", () => {
  test.use({ storageState: OWNER1_STATE });
  test("KPI = dashboard_kpis(azi) cu sesiunea lui owner1, consola curată", async ({ page }) => {
    const errors = watchConsole(page);
    const expected = formatKpis(await kpisFor(sessionFromStateFile(OWNER1_STATE).access_token));
    await page.goto("/dashboard");
    const shown = await readKpis(page);
    expect(shown).toEqual(expected);
    // Independent of dashboard_kpis() and of formatLei(): the month's payments summed straight from
    // public.payments (admin key) and formatted by hand, so a shared bug in the RPC, the helper and
    // the card cannot hide. Works in any month (no seed literal).
    expect(shown.revenue).toBe(handFormatLei(await revenueFromTable(sessionFromStateFile(OWNER1_STATE).user!.id)));
    await expect(page.getByTestId("greeting")).toHaveText("Bună, Ana");
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("owner2", () => {
  test.use({ storageState: OWNER2_STATE });
  test("owner2 vede doar cifrele lui, nu pe ale lui owner1", async ({ page }) => {
    const errors = watchConsole(page);
    const own = formatKpis(await kpisFor(sessionFromStateFile(OWNER2_STATE).access_token));
    const other = formatKpis(await kpisFor(sessionFromStateFile(OWNER1_STATE).access_token));
    await page.goto("/dashboard");
    const shown = await readKpis(page);
    expect(shown).toEqual(own);
    expect(shown).not.toEqual(other);
    await expect(page.getByTestId("greeting")).toHaveText("Bună, Mihai");
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
