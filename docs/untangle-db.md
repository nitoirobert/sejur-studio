# untangle-db: decision log

Method: the `untangle-codebase` skill, applied to the database only (schema, constraints, RLS, functions,
seed). Branch `untangle-db`, off `owner-dashboard`. Migrations 0001-0004 are untouched; everything is new
files 0005-0009. Nothing committed. Tests run on the test project `enqnxbktjwcqydghvenu` only (no local
Docker). Robert approves; a production run is Taka's / Robert's.

## Summary

The schema was sound; the tangles were rules written twice with nothing keeping the copies equal.
Nine problems, five migrations. 13 pgTAP files (see "Tests and seed"); every new rule has its own test in
`13_untangle_rules`. Applied on the test project 7 Nov 2026: `db:reset:dev` ok, `db:test` 13 files, 269 tests, PASS; `db:types` regenerated. Behaviour the owner dashboard and the public
page see is unchanged, except the nine items in "Intended behaviour changes".

## Problems and fixes

Format: problem (kind) -> fix. Fixes are listed top-down: a fix higher up removes the problem below it.

### 1. Tenant consistency was a trigger with a branch per table (hidden link + special cases) -> 0006
`enforce_organization()` filled `organization_id` from the parent with an `if tg_table_name = ...` chain,
and `photos_storage_path_owner` held a second copy of the rule. Every new child table meant editing the
function. It also never checked links that matter (a photo's unit in another property; a feed or booking
of another unit; a booking whose `source` differs from its feed's provider).
Fix: each parent gets `unique (id, organization_id)` (and `(id, property_id)`, `(id, unit_id)`,
`(id, unit_id, provider)` where a child must agree on those), and every child foreign key spans both
columns. The engine enforces it on insert and update, for every table alike. The trigger and function are
dropped.

### 2. `ical_provider` was `booking_source` minus `direct` (surplus) -> 0005
Same value list in two enums, joined by convention. Fix: `ical_feeds.provider` uses `booking_source`, with
`check (provider <> 'direct')`; `ical_provider` dropped. 0006 then ties `bookings.source` to the feed's
provider by foreign key.

### 3. Facts stored twice (hidden link) -> 0007
- `payments.status` (`refunded`, `partially_refunded`) vs `payments.refunded_amount`: now one constraint
  (`payments_refund_state_check`) that makes the pair agree; it replaces `payments_refund_check`.
- `bookings.stripe_payment_intent_id` copied `payments.stripe_payment_intent_id`: column dropped (a booking
  can have several payments; the booking keeps `stripe_checkout_session_id`, which is how the webhook finds
  the hold).
- `sync_conflicts.resolved` vs `resolved_at`: `resolved` dropped (backfilled into `resolved_at` first);
  index rebuilt on `resolved_at`.

### 4. "Is this booking live?" was written in two readers, hold expiry in a third place (needless links + special case) -> 0008
`dashboard_chart` and `public_busy_ranges` each had the `confirmed/blocked/unexpired hold` test, with a
`hold_expires_at is null` special case ("live forever"). `create_manual_booking` released expired holds as a
side effect.
Fix: `bookings_hold_expiry_check` (a hold always has an expiry, removing the null case);
`is_live_booking(status, hold_expires_at)` is the one reader-side definition; `expire_holds(unit)` is the
one place that expires holds (create_manual_booking now calls it; the planned pg_cron job and the Stripe
webhook call the same function). The exclusion constraint cannot use `now()`, so an expired hold keeps
blocking its dates until `expire_holds()` runs (unchanged, now documented). The boundary is one instant:
`expire_holds()` takes `hold_expires_at <= now()`, `is_live_booking` keeps `> now()`, so a hold is either
live or due, never both.
`is_live_booking` is a SQL-standard body (`return ...`), `stable`, security invoker and without a `SET`
clause, so the planner inlines it into `dashboard_chart` and `public_busy_ranges` (tested with `explain`).
Leaving out `set search_path` is safe here: the body is parsed and bound to objects when the function is
created (`pg_proc.prosqlbody`), so a caller's search_path cannot redirect `now()`, the enum or the operators.
The Supabase advisor may still list it under "function search_path mutable"; that warning does not apply to
a pre-parsed body.
`bookings.status` loses the `'hold'` default from 0001: an insert without a status is refused (`23502`).
`'confirmed'` was the alternative, but a forgotten status would then occupy dates as a paid stay. Every
writer states it: `create_manual_booking` `confirmed`, the Stripe checkout `hold` with an expiry, iCal
`blocked`.

### 5. An imported booking could have no event id, and a re-sync could duplicate it (special case) -> 0008
`bookings_ical_event_check` (feed set implies `external_uid` set) and unique `(ical_feed_id, external_uid)`
replace the plain index `bookings_ical_feed_idx`. The sync upserts on that key.

### 6. KPI rules disagreed with their own docs (special case) -> 0008
Revenue skipped partly refunded payments even though they still earned money; the 30-day horizon appeared
twice. Revenue is now `amount - refunded_amount` over `succeeded` and `partially_refunded`; horizon written
once. `dashboard_kpis` still returns the literal `'RON'`.

### 7. "Published unit of an active property" written three times in RLS (needless links) -> 0009
`units_public`, `unit_prices_public`, `photos_public` each re-stated it. A policy expression runs under the
caller's RLS, so `unit_prices` and `photos` now ask "can I see this unit / property?" and the answer comes
from `units_public` and `properties_public`. anon sees the same rows (checked). The rule must still be
repeated once in `public_busy_ranges`, because a `security definer` function bypasses RLS; a comment there
says to keep it in step.

### 8. Four identical storage policies (surplus) -> 0009
Select/insert/update/delete on `storage.objects` had the same predicate. One `FOR ALL` policy
`photos_owner`.

### 9. Delete actions blocked deleting a whole organization (hidden link) -> 0006
`bookings -> units` and `payments -> bookings` were `ON DELETE RESTRICT`, which fires before the cascade
finishes, so an organization with bookings could not be deleted. They are now `NO ACTION` (checked at end
of statement): deleting an organization works, deleting a unit that still has bookings is still refused
(`23503`). Set-null links use column lists (`on delete set null (guest_id)`) so `organization_id` is never
nulled.

## Kept as is (looked at, left alone)
- `public_busy_ranges` security definer and its repeated visibility rule: needed, see 7.
- `dashboard_kpis` returning `'RON'` and using `Europe/Bucharest`: product decisions (one country, one
  currency for now), not tangles. Flagged for Robert below.
- `bookings.stay` generated column, `bookings_no_overlap`, `photos_storage_path_owner`, the
  `set_updated_at` trigger, `handle_new_user`, the generic owner-policy loop of 0002: each is the single
  definition of its rule.
- Money as integer bani, enums for closed sets: fine.

## Intended behaviour changes (api-engineer / Robert must know)
1. `organization_id` must be passed on every insert into a child table (NOT NULL; nothing fills it in).
2. A cross-organization or cross-unit link fails with `23503`, not `42501`.
3. A booking with `status = 'hold'` needs `hold_expires_at` (`23514` otherwise).
4. An imported booking needs `external_uid`, and one event is one booking per feed (`23505` on a duplicate).
5. Revenue KPI now includes partly refunded payments, net of the refund.
6. A payment's refund status and `refunded_amount` must be updated together, in one statement
   (`23514` when only one of them changes).
7. A unit that has photos cannot change property (`23503`): move or delete its photos first.
8. Linked rows cannot change their link keys (`23503`): a feed's `provider` or `unit_id` while bookings
   point at it, and a booking's `unit_id` while it is imported from a feed or named by a sync_conflict.
9. `bookings.status` has no default: every insert passes it (`23502` otherwise).
Removed: `bookings.stripe_payment_intent_id`, `sync_conflicts.resolved`, enum `ical_provider`, function
`enforce_organization()`, the default of `bookings.status`. Added: `is_live_booking()`, `expire_holds()`.

Grants on the two new functions (`05_functions_security` asserts the grantees and prints `pg_proc.proacl`
with `diag`; cloud 7 Nov: `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`): EXECUTE for `authenticated` (owners) and `service_role`
(Stripe webhook, cron), both granted explicitly in 0008; none for `PUBLIC` or `anon`. Without the explicit
grant `service_role` would still have had it through Supabase's default privileges on schema `public`; the
grant makes it independent of them. `expire_holds()` as `service_role` bypasses RLS and releases the due
holds of every organization; as an owner it releases only their own.
`supabase/types.ts` is updated to match (hand-patched to the exact relationships of a local `gen types`;
the generator output is not formatted like the file, and no formatter is installed).

## Risk per migration
All tables are small today; every lock is a short ACCESS EXCLUSIVE. Adding a check or foreign key validates
existing rows, so a failure is loud and rolls the migration back.

| Migration | Risk | Pre-check on a DB with real data |
|---|---|---|
| 0005 | Rewrites `ical_feeds` (tiny). Fails if a feed has a provider outside the enum (cannot happen). Irreversible: type dropped. | none |
| 0006 | Nine unique keys, 13 foreign keys re-validated. Fails if any child row already disagrees with its parent (the old trigger prevented most). Drops a function the API may not call. | joins comparing `organization_id` child vs parent return 0 rows |
| 0007 | Drops two columns (data loss by design: `bookings.stripe_payment_intent_id`, `sync_conflicts.resolved`). The refund constraint fails on inconsistent payment rows. | `select count(*) from payments where not (case status ...)`; confirm `bookings.stripe_payment_intent_id` is empty or duplicated in `payments` |
| 0008 | Hold-expiry check and iCal unique key can fail on existing rows; function bodies replaced (same signatures); `bookings.status` default dropped (a writer relying on it now fails with `23502`). | `select count(*) from bookings where status='hold' and hold_expires_at is null` must be 0; no duplicate `(ical_feed_id, external_uid)`; no `ical_feed_id` with null `external_uid` |
| 0009 | Policies dropped and recreated in one transaction, no gap. Storage policy name changes. | none |

Rollback: write a new migration; nothing here is reversible in place (0005 and 0007 drop things).

## What Robert must approve
1. Dropping `bookings.stripe_payment_intent_id` (the webhook must read it from `payments`).
2. Explicit `organization_id` on inserts and `23503` instead of `42501` (api and web error mapping).
3. Holds always carry an expiry; the pg_cron job calling `expire_holds()` still has to be scheduled (D6).
4. One iCal event = one booking per feed (unique key).
5. Revenue KPI counting partly refunded payments.
6. No default status on bookings (every writer states it).
7. Open product questions, unchanged by this work: fixed `RON`, fixed `Europe/Bucharest`.

## Tests and seed
`seed.sql` passes `organization_id` explicitly on units, unit_prices, bookings, payments, and a status on
every booking; its KPI values (day A: 3, 1, 31.7, 808000) are unchanged. Test changes:
- `02_bookings_constraints`: the hold fixture gets an expiry; `bookings.status` has no default and an insert
  without it gives `23502`.
- `03_rls`: cross-organization link cases expect `23503` (the unit_price case uses a `season` row so the
  one-base-per-unit unique does not fire first).
- `05_functions_security`: `owner_fns()` includes `expire_holds` and `is_live_booking` (6 functions); no
  EXECUTE for `PUBLIC` or `anon`, explicit EXECUTE for `service_role`, exact grantees; `is_live_booking` is
  inlinable (catalog flags and an `explain` without the function name).
- `10_anon_public`: an unpublished unit of an active property (`unit1_unpub` in `prop1b`) shows no photo and
  no price to anon; a property photo and a published unit stay visible.
- `13_untangle_rules` (new): hold without expiry `23514`; imported booking without `external_uid` `23514`,
  duplicate event `23505`, feed `direct` `23514`; guest, feed, source and sync_conflict links across orgs or
  units `23503`; photo with a unit of another property `23503`; refund state on insert and update; revenue
  net of partial refunds; linked feed / booking / unit keys cannot change; `expire_holds()` count and the
  `<=` / `>` boundary with `is_live_booking`, owner vs `service_role`; deleting a unit with bookings `23503`,
  deleting a whole organization works and leaves no row.

## How to verify
The PM applies it on the test project after tests pass:
```
cd C:\sejur-studio
npm run db:reset:dev       # test project enqnxbktjwcqydghvenu only: 0001-0009 + seed
npm run db:test            # 13 files, all must pass
npm run db:types           # supabase/types.ts
```
