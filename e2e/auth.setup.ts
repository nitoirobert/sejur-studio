import fs from "node:fs";
import { expect, test as setup } from "@playwright/test";
import { AUTH_DIR, OWNER1_STATE, OWNER2_STATE, SEED, SEED_SNAPSHOT, admin } from "./support/helpers";

// Two UI sign-ins (owner1, owner2), reused by every spec. Keeps the auth rate limit budget low.
setup.beforeAll(() => fs.mkdirSync(AUTH_DIR, { recursive: true }));

for (const [who, file] of [
  ["owner1", OWNER1_STATE],
  ["owner2", OWNER2_STATE],
] as const) {
  setup(`sign in ${who}`, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SEED[who].email);
    await page.getByLabel("Parolă", { exact: true }).fill(SEED.password);
    await page.getByRole("button", { name: "Intră în cont" }).click();
    // Soft navigation: wait for the data, not for a load event.
    await expect(page.getByTestId("kpi-revenue-value")).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.context().storageState({ path: file });
  });
}

// What the seed accounts look like before the run; cleanup.teardown.ts checks they are unchanged.
setup("snapshot seed accounts", async () => {
  const db = admin();
  const snapshot: Record<string, unknown> = {};
  for (const who of ["owner1", "owner2"] as const) {
    const { data: list, error } = await db.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    const user = list.users.find((u) => u.email === SEED[who].email);
    expect(user, `${who} exists`).toBeTruthy();
    const [{ data: profile }, { data: members }] = await Promise.all([
      db.from("profiles").select("*").eq("user_id", user!.id).single(),
      db.from("organization_members").select("*").eq("user_id", user!.id),
    ]);
    snapshot[who] = { id: user!.id, profile, members };
  }
  fs.writeFileSync(SEED_SNAPSHOT, JSON.stringify(snapshot, null, 2));
});
