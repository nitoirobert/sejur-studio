import fs from "node:fs";
import { expect, test } from "@playwright/test";
import {
  NBSP,
  NEW_USER_FILE,
  NEW_USER_STATE,
  admin,
  readKpis,
  sessionFromCookies,
  uniqueEmail,
  watchConsole,
} from "./support/helpers";

// Check 1 (and the "cont nou" part of check 3): sign-up lands straight in /dashboard.
test("cont nou: direct în panou, salut cu prenumele, 1 org + 1 owner + 1 profil, KPI zero", async ({ page }) => {
  const errors = watchConsole(page);
  const email = uniqueEmail();
  const fullName = "  Ștefan Țurcanu Ionescu ";

  await page.goto("/cont-nou");
  await page.getByLabel("Nume complet").fill(fullName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Parolă", { exact: true }).fill("Parola-Noua-123");
  await page.getByRole("button", { name: "Creează contul" }).click();

  await expect(page.getByTestId("kpi-revenue-value")).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("greeting")).toHaveText("Bună, Ștefan");

  // New account: 0 / 0 / 0% / 0 lei.
  expect(await readKpis(page)).toEqual({ arrivals: "0", departures: "0", occupancy: "0%", revenue: `0${NBSP}lei` });

  const cookies = await page.context().cookies();
  const session = sessionFromCookies(cookies);
  const userId = session.user!.id;
  await page.context().storageState({ path: NEW_USER_STATE });

  const db = admin();
  const [{ data: members }, { data: profiles }] = await Promise.all([
    db.from("organization_members").select("organization_id, role").eq("user_id", userId),
    db.from("profiles").select("full_name").eq("user_id", userId),
  ]);
  expect(members).toHaveLength(1);
  expect(members![0].role).toBe("owner");
  expect(profiles).toHaveLength(1);
  expect(profiles![0].full_name).toBe("Ștefan Țurcanu Ionescu");
  const { data: orgs } = await db.from("organizations").select("id").eq("id", members![0].organization_id);
  expect(orgs).toHaveLength(1);
  // Only this user is in the new organization.
  const { data: orgMembers } = await db
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", members![0].organization_id);
  expect(orgMembers).toHaveLength(1);

  fs.writeFileSync(NEW_USER_FILE, JSON.stringify({ userId, email, organizationId: members![0].organization_id }));
  expect(errors, errors.join("\n")).toEqual([]);
});
