// Demo host data for showing the owner panel: links a host account to the demo catalogue organization
// ("Sejur Demo Turism SRL", see seed-catalog.mjs) as an owner, and fills that organization with fake
// bookings around today: past stays with payments, guests in house, arrivals and departures today,
// upcoming stays, pending requests (holds), a manual block and a cancellation.
//
//   node scripts/seed-demo-host.mjs <host-email>    -> link the account + (re)create the demo bookings
//   node scripts/seed-demo-host.mjs clean           -> remove the demo bookings (keeps the account link)
//
// Idempotent: every demo guest has an e-mail at DEMO_DOMAIN; a run first deletes those guests' bookings
// and payments, then recreates them relative to today. Bookings of real people are never touched.
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (never committed).
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { ORG } from "./catalog-data.mjs";

const root = path.resolve(import.meta.dirname, "..");
for (const line of fs.existsSync(path.join(root, ".env.local")) ? fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const DEMO_DOMAIN = "oaspete-demo.example.com";
const arg = process.argv[2];
if (!arg) throw new Error("usage: node scripts/seed-demo-host.mjs <host-email> | clean");

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ok = (what, { data, error }) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

// ---------------------------------------------------------------- dates (Europe/Bucharest)
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date());
const day = (offset) => new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
const at = (offset, hour = 11) => new Date(Date.parse(`${day(offset)}T${String(hour).padStart(2, "0")}:00:00Z`)).toISOString();

const NAMES = [
  "Andrei Popescu", "Maria Ionescu", "Elena Dumitru", "Mihai Stan", "Ioana Georgescu", "Radu Constantin",
  "Ana Marinescu", "Cristian Pop", "Bianca Stoica", "Vlad Munteanu", "Diana Rusu", "Alexandru Matei",
  "Irina Lazăr", "Paul Neagu", "Simona Tudor", "Gabriel Ene", "Larisa Dinu", "Tudor Barbu", "Oana Cristea",
  "Sorin Moldovan", "Roxana Vasile", "Ștefan Ilie", "Carmen Nistor", "Florin Avram", "Teodora Pavel",
];

async function demoOrg() {
  const org = ok("org", await sb.from("organizations").select("id, name").eq("slug", ORG.slug).maybeSingle());
  if (!org) throw new Error(`organization "${ORG.slug}" not found: run seed-catalog.mjs seed first`);
  return org;
}

async function clean(orgId) {
  const guests = ok("demo guests", await sb.from("guests").select("id").eq("organization_id", orgId).like("email", `%@${DEMO_DOMAIN}`));
  const ids = guests.map((g) => g.id);
  if (ids.length) {
    const bookings = ok("demo bookings", await sb.from("bookings").select("id").in("guest_id", ids));
    const bIds = bookings.map((b) => b.id);
    if (bIds.length) {
      ok("payments", await sb.from("payments").delete().in("booking_id", bIds));
      ok("bookings", await sb.from("bookings").delete().in("id", bIds));
    }
    ok("guests", await sb.from("guests").delete().in("id", ids));
  }
  // Manual blocks have no guest: they carry this source + a fixed external note in the unit's calendar.
  ok("blocks", await sb.from("bookings").delete().eq("organization_id", orgId).eq("status", "blocked").eq("source", "altul").is("guest_id", null).is("ical_feed_id", null));
  console.log(`clean: removed ${ids.length} demo guests and their bookings`);
}

async function linkHost(email, orgId) {
  let user = null;
  for (let page = 1; page <= 20 && !user; page++) {
    const { users } = ok("users", await sb.auth.admin.listUsers({ page, perPage: 200 }));
    user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
    if (users.length < 200) break;
  }
  if (!user) throw new Error(`no account with e-mail ${email}`);
  const existing = ok("membership", await sb.from("organization_members").select("user_id").eq("organization_id", orgId).eq("user_id", user.id).maybeSingle());
  if (!existing) ok("link", await sb.from("organization_members").insert({ organization_id: orgId, user_id: user.id, role: "owner" }));
  console.log(`${email} is an owner of ${ORG.name}${existing ? " (already)" : ""}`);
}

// Stays per unit as [checkInOffset, nights, status]; offsets are days from today. Laid out so no two
// stays of the same unit overlap (the bookings_no_overlap constraint would refuse it).
const PLANS = [
  [[-40, 3, "confirmed"], [-12, 4, "confirmed"], [-2, 4, "confirmed"], [6, 3, "confirmed"], [20, 5, "confirmed"]], // in house now
  [[-30, 2, "confirmed"], [-9, 3, "confirmed"], [0, 3, "confirmed"], [12, 4, "confirmed"]], // arrives today
  [[-25, 5, "confirmed"], [-3, 3, "confirmed"], [3, 2, "hold"], [15, 3, "confirmed"]], // leaves today, request pending
  [[-18, 4, "confirmed"], [0, 2, "confirmed"], [9, 4, "confirmed"], [25, 2, "confirmed"]], // arrives today
  [[-50, 3, "confirmed"], [-6, 2, "cancelled"], [2, 5, "confirmed"], [18, 3, "confirmed"]],
  [[-14, 3, "confirmed"], [-1, 3, "confirmed"], [8, 2, "hold"], [22, 4, "confirmed"]], // in house now
  [[-35, 4, "confirmed"], [4, 3, "blocked"], [11, 3, "confirmed"]], // owner blocked a few days
  [[-21, 2, "confirmed"], [1, 4, "confirmed"], [14, 2, "confirmed"]],
  [[-8, 3, "confirmed"], [5, 3, "confirmed"], [27, 3, "confirmed"]],
  [[-16, 5, "confirmed"], [-4, 3, "confirmed"], [10, 5, "confirmed"]],
];

async function seed(orgId) {
  const units = ok("units", await sb.from("units").select("id, name, max_guests, property_id").eq("organization_id", orgId).eq("is_published", true).order("property_id").order("position"));
  const prices = ok("prices", await sb.from("unit_prices").select("unit_id, price_per_night").eq("organization_id", orgId).eq("kind", "base"));
  const priceOf = new Map(prices.map((p) => [p.unit_id, p.price_per_night]));
  if (units.length < PLANS.length) throw new Error(`need ${PLANS.length} published units, found ${units.length}`);

  let n = 0, made = 0, paid = 0;
  for (let i = 0; i < PLANS.length; i++) {
    const unit = units[i * Math.floor(units.length / PLANS.length)];
    for (const [offset, nights, status] of PLANS[i]) {
      const check_in = day(offset);
      const check_out = day(offset + nights);
      const total = (priceOf.get(unit.id) ?? 30000) * nights;
      let guest_id = null;
      if (status !== "blocked") {
        const name = NAMES[n++ % NAMES.length];
        const slug = name.normalize("NFD").replace(/[^\w ]/g, "").toLowerCase().replace(/ /g, ".");
        guest_id = ok("guest", await sb.from("guests").insert({
          organization_id: orgId, full_name: name, email: `${slug}.${n}@${DEMO_DOMAIN}`, phone: `+40 7${String(20000000 + n * 137911).slice(0, 8)}`,
        }).select("id").single()).id;
      }
      const adults = Math.min(2, unit.max_guests);
      const res = await sb.from("bookings").insert({
        organization_id: orgId, unit_id: unit.id, guest_id, check_in, check_out, status,
        source: status === "blocked" ? "altul" : offset % 3 === 0 ? "booking" : "direct",
        adults: status === "blocked" ? 0 : adults, children: status === "blocked" ? 0 : offset % 4 === 0 ? 1 : 0,
        total_amount: status === "blocked" ? 0 : total,
        hold_expires_at: status === "hold" ? new Date(Date.now() + 20 * 3_600_000).toISOString() : null,
        created_at: at(Math.min(offset - 10, -1), 9),
      }).select("id").single();
      if (res.error?.code === "23P01") {
        // A real booking already holds these nights: leave it alone, skip this demo stay.
        if (guest_id) ok("guest", await sb.from("guests").delete().eq("id", guest_id));
        console.log(`skip: ${unit.name} ${check_in} (taken)`);
        continue;
      }
      const booking = ok(`booking ${unit.name} ${check_in}`, res);
      made++;
      // Paid in full at booking time for past and current stays; a 30 % deposit for upcoming ones.
      if (status === "confirmed") {
        const upcoming = offset > 0;
        const amount = upcoming ? Math.round(total * 0.3) : total;
        ok("payment", await sb.from("payments").insert({
          organization_id: orgId, booking_id: booking.id, amount, currency: "RON", status: "succeeded",
          created_at: at(Math.min(Math.max(offset - 7, -9), 0), 14), // never in the future; most land in this month ("Încasări luna aceasta")
        }));
        paid++;
      }
    }
  }
  console.log(`seed: ${made} bookings (${paid} with payments) on ${PLANS.length} units, around ${today}`);
}

const org = await demoOrg();
await clean(org.id);
if (arg !== "clean") {
  await linkHost(arg, org.id);
  await seed(org.id);
}
