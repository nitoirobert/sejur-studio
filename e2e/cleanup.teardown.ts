import fs from "node:fs";
import { expect, test as teardown } from "@playwright/test";
import { SEED, SEED_SNAPSHOT, admin } from "./support/helpers";
import { GUEST_PREFIX, deleteE2EBookings } from "./support/chart";
import { PROP_PREFIX, deleteE2EProperties } from "./support/props";

// Check 13: every e2e+<timestamp>@example.com account is deleted (admin API, key only in
// .env.test.local). Deleting the auth user cascades to organization_members and profiles
// (0001_core.sql: user_id ... on delete cascade). There is NO cascade from the user to the
// organization, so the organization is deleted explicitly afterwards (its children cascade from it).
// owner1/owner2 stay untouched.
teardown("șterge conturile e2e + firmele lor; membru/profil/firmă dispar; owner1/owner2 neatinși", async () => {
  const db = admin();
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  // Also the stray e2e+ui-<n>@example.com accounts left by manual UI checks (brief 04).
  const e2e = users.filter((u) => /^e2e\+(\d+|ui-[a-z0-9-]+)@example\.com$/.test(u.email ?? ""));
  const seedOrgs = new Set<string>();
  for (const who of ["owner1", "owner2"] as const) {
    const u = users.find((x) => x.email === SEED[who].email);
    const { data } = await db.from("organization_members").select("organization_id").eq("user_id", u!.id);
    (data ?? []).forEach((m) => seedOrgs.add(m.organization_id as string));
  }
  console.log(`e2e accounts to delete: ${e2e.length}`);

  for (const u of e2e) {
    const { data: members } = await db.from("organization_members").select("organization_id").eq("user_id", u.id);
    const orgIds = (members ?? []).map((m) => m.organization_id as string).filter((id) => !seedOrgs.has(id));

    const { error } = await db.auth.admin.deleteUser(u.id);
    expect(error, `delete ${u.email}`).toBeNull();

    // Cascade from auth.users: membership and profile are gone.
    const [{ data: p }, { data: m }] = await Promise.all([
      db.from("profiles").select("user_id").eq("user_id", u.id),
      db.from("organization_members").select("user_id").eq("user_id", u.id),
    ]);
    expect(p, `profile of ${u.email}`).toEqual([]);
    expect(m, `membership of ${u.email}`).toEqual([]);

    // The organization is not cascaded from the user: delete it only if nobody else is a member.
    for (const orgId of orgIds) {
      const { data: others } = await db.from("organization_members").select("user_id").eq("organization_id", orgId);
      if ((others ?? []).length > 0) continue;
      const { error: orgErr } = await db.from("organizations").delete().eq("id", orgId);
      expect(orgErr, `delete organization ${orgId}`).toBeNull();
      const { data: o } = await db.from("organizations").select("id").eq("id", orgId);
      expect(o, `organization of ${u.email}`).toEqual([]);
    }
  }

  const { data: after } = await db.auth.admin.listUsers({ perPage: 1000 });
  expect(after.users.filter((u) => /^e2e\+/.test(u.email ?? ""))).toEqual([]);

  // Seed accounts: still there, same profile and membership as before the run.
  if (fs.existsSync(SEED_SNAPSHOT)) {
    const before = JSON.parse(fs.readFileSync(SEED_SNAPSHOT, "utf8"));
    for (const who of ["owner1", "owner2"] as const) {
      const user = after.users.find((u) => u.email === SEED[who].email);
      expect(user?.id, who).toBe(before[who].id);
      const [{ data: profile }, { data: members }] = await Promise.all([
        db.from("profiles").select("*").eq("user_id", user!.id).single(),
        db.from("organization_members").select("*").eq("user_id", user!.id),
      ]);
      expect(profile, `${who} profile`).toEqual(before[who].profile);
      expect(members, `${who} membership`).toEqual(before[who].members);
    }
  }
});

// Brief 04: safety net for the property specs (each also cleans in afterAll): every "E2E ..." property
// goes, with its units, prices, photo rows, files and bookings. Seed properties are never named "E2E ".
teardown("șterge proprietățile e2e („E2E …”) cu unități, prețuri, poze și fișiere", async () => {
  const n = await deleteE2EProperties();
  console.log(`e2e properties deleted: ${n}`);
  const { data } = await admin().from("properties").select("id").like("name", `${PROP_PREFIX}%`);
  expect(data).toEqual([]);
});

// Brief 03: every booking the chart specs create (guest name "E2E ...") is deleted with the admin
// key, together with its guest; afterwards none is left.
teardown("șterge rezervările e2e (oaspete „E2E …”) și oaspeții lor", async () => {
  const n = await deleteE2EBookings();
  console.log(`e2e guests/bookings deleted: ${n}`);
  const { data } = await admin().from("guests").select("id").like("full_name", `${GUEST_PREFIX}%`);
  expect(data).toEqual([]);
});
