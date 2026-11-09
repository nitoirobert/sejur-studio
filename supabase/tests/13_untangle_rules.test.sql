-- Check 13: the rules added by the cleanup migrations 0005-0009 (docs/untangle-db.md).
-- Constraint cases run as postgres (RLS bypassed: only the constraint can refuse); functions run
-- as the role that calls them in production. Dates in 2034-2035 so nothing collides with the seed.
begin;
\ir _lib/helpers.psql
select * from no_plan();

insert into tests.ctx values
  ('feed1',  'f1000000-0000-4000-8000-000000000001'),  -- unit1,  booking
  ('feed1b', 'f1000000-0000-4000-8000-000000000002'),  -- unit1b, airbnb
  ('feed3',  'f1000000-0000-4000-8000-000000000003'),  -- unit1,  altul, never linked
  ('feed2',  'f2000000-0000-4000-8000-000000000001'),  -- unit2 (org2), booking
  ('guest2', 'c2000000-0000-4000-8000-000000000001'),  -- org2
  ('bk_ev1', 'd1000000-0000-4000-8000-000000000001'),  -- unit1, feed1, ev-1
  ('bk_ev2', 'd1000000-0000-4000-8000-000000000002'),  -- unit1, feed1, ev-2
  ('bk_dir', 'd1000000-0000-4000-8000-000000000003'),  -- unit1, direct
  ('bk_b',   'd1000000-0000-4000-8000-000000000004');  -- unit1b, direct

insert into public.ical_feeds (id, organization_id, unit_id, url, provider) values
  (tests.id('feed1'),  tests.id('org1'), tests.id('unit1'),  'https://example.com/1.ics', 'booking'),
  (tests.id('feed1b'), tests.id('org1'), tests.id('unit1b'), 'https://example.com/1b.ics', 'airbnb'),
  (tests.id('feed3'),  tests.id('org1'), tests.id('unit1'),  'https://example.com/3.ics', 'altul'),
  (tests.id('feed2'),  tests.id('org2'), tests.id('unit2'),  'https://example.com/2.ics', 'booking');
insert into public.guests (id, organization_id, full_name) values (tests.id('guest2'), tests.id('org2'), 'Oaspete Org2');
insert into public.bookings (id, organization_id, unit_id, ical_feed_id, external_uid, check_in, check_out,
                             status, source, adults, children, total_amount) values
  (tests.id('bk_ev1'), tests.id('org1'), tests.id('unit1'), tests.id('feed1'), 'ev-1', '2034-01-10', '2034-01-12',
   'blocked', 'booking', 1, 0, 0),
  (tests.id('bk_ev2'), tests.id('org1'), tests.id('unit1'), tests.id('feed1'), 'ev-2', '2034-01-20', '2034-01-22',
   'blocked', 'booking', 1, 0, 0),
  (tests.id('bk_dir'), tests.id('org1'), tests.id('unit1'), null, null, '2034-02-01', '2034-02-05',
   'confirmed', 'direct', 2, 0, 100000),
  (tests.id('bk_b'), tests.id('org1'), tests.id('unit1b'), null, null, '2034-02-10', '2034-02-12',
   'confirmed', 'direct', 2, 0, 50000);

-- Insert statement for a booking on unit1 (org1) with the given extra columns.
create or replace function tests.bk13(cols text, vals text, ci date, co date) returns text
language sql as $$
  select format($f$insert into public.bookings (organization_id, unit_id, check_in, check_out, adults, children,
                                              total_amount, %s)
                   values (%L, %L, %L, %L, 1, 0, 0, %s)$f$,
                cols, tests.id('org1'), tests.id('unit1'), ci, co, vals)
$$;

-- ---------------------------------------------------------------------------
-- Holds always carry an expiry (bookings_hold_expiry_check)
-- ---------------------------------------------------------------------------
select is(tests.err(tests.bk13('status, source', $$'hold', 'direct'$$, '2034-03-01', '2034-03-03')), '23514',
  'hold without hold_expires_at -> 23514');
select is(tests.err(tests.bk13('status, source, hold_expires_at', $$'hold', 'direct', now() + interval '1 hour'$$,
                               '2034-03-01', '2034-03-03')), null,
  'hold with hold_expires_at inserts (control)');

-- ---------------------------------------------------------------------------
-- iCal: event id required, one event = one booking per feed, a feed is never direct
-- ---------------------------------------------------------------------------
select is(tests.err(tests.bk13('status, source, ical_feed_id', format($$'blocked', 'booking', %L$$, tests.id('feed1')),
                               '2034-03-10', '2034-03-12')), '23514',
  'imported booking (feed set) without external_uid -> 23514');
select is(tests.err(tests.bk13('status, source, ical_feed_id, external_uid',
                               format($$'blocked', 'booking', %L, 'ev-1'$$, tests.id('feed1')),
                               '2034-03-10', '2034-03-12')), '23505',
  'duplicate iCal event (same feed, same external_uid) -> 23505');
select is(tests.err(format($$insert into public.bookings (organization_id, unit_id, ical_feed_id, external_uid,
                               check_in, check_out, status, source, adults, children, total_amount)
                             values (%L, %L, %L, 'ev-1', '2034-03-10', '2034-03-12', 'blocked', 'airbnb', 1, 0, 0)$$,
                           tests.id('org1'), tests.id('unit1b'), tests.id('feed1b'))), null,
  'same external_uid on another feed inserts (unique per feed)');
select is(tests.err(format($$insert into public.ical_feeds (organization_id, unit_id, url, provider)
                             values (%L, %L, 'https://example.com/d.ics', 'direct')$$,
                           tests.id('org1'), tests.id('unit1'))), '23514',
  'ical feed with provider direct -> 23514');
select is((select data_type || '/' || udt_name from information_schema.columns
            where table_schema = 'public' and table_name = 'ical_feeds' and column_name = 'provider'),
  'USER-DEFINED/booking_source', 'ical_feeds.provider uses booking_source');
select hasnt_type('public', 'ical_provider', 'enum ical_provider is gone');

-- ---------------------------------------------------------------------------
-- Guest, feed and source links across organizations or units -> 23503
-- ---------------------------------------------------------------------------
select is(tests.err(tests.bk13('status, source, guest_id', format($$'confirmed', 'direct', %L$$, tests.id('guest2')),
                               '2034-03-20', '2034-03-22')), '23503',
  'booking of org1 with a guest of org2 -> 23503');
select is(tests.err(tests.bk13('status, source, ical_feed_id, external_uid',
                               format($$'blocked', 'airbnb', %L, 'x-1'$$, tests.id('feed1b')),
                               '2034-03-20', '2034-03-22')), '23503',
  'booking on unit1 with the feed of unit1b (same org, other unit) -> 23503');
select is(tests.err(tests.bk13('status, source, ical_feed_id, external_uid',
                               format($$'blocked', 'booking', %L, 'x-2'$$, tests.id('feed2')),
                               '2034-03-20', '2034-03-22')), '23503',
  'booking on unit1 with a feed of org2 -> 23503');
select is(tests.err(tests.bk13('status, source, ical_feed_id, external_uid',
                               format($$'blocked', 'airbnb', %L, 'x-3'$$, tests.id('feed1')),
                               '2034-03-20', '2034-03-22')), '23503',
  'booking source differs from its feed provider -> 23503');
select is(tests.err(format($$insert into public.ical_feeds (organization_id, unit_id, url, provider)
                             values (%L, %L, 'https://example.com/x.ics', 'booking')$$,
                           tests.id('org1'), tests.id('unit2'))), '23503',
  'ical feed of org1 on a unit of org2 -> 23503');
select is(tests.err(format($$insert into public.payments (organization_id, booking_id, amount, status)
                             values (%L, %L, 1000, 'pending')$$, tests.id('org2'), tests.id('bk_dir'))), '23503',
  'payment of org2 for a booking of org1 -> 23503');

-- ---------------------------------------------------------------------------
-- Photos: the unit belongs to the photo's property
-- ---------------------------------------------------------------------------
select is(tests.err(format($$insert into public.photos (organization_id, property_id, unit_id, storage_path)
                             values (%L, %L, %L, %L)$$, tests.id('org1'), tests.id('prop1'), tests.id('unit1_unpub'),
                           tests.id('org1') || '/' || tests.id('prop1') || '/other-prop-unit.webp')), '23503',
  'photo of prop1 pointing at a unit of prop1b -> 23503');
select is(tests.err(format($$insert into public.photos (organization_id, property_id, unit_id, storage_path)
                             values (%L, %L, %L, %L)$$, tests.id('org1'), tests.id('prop1'), tests.id('unit1'),
                           tests.id('org1') || '/' || tests.id('prop1') || '/unit1.webp')), null,
  'photo of prop1 with a unit of prop1 inserts (control)');

-- A unit with photos cannot change property (the photo would point at another property).
select is(tests.err(format($$update public.units set property_id = %L where id = %L$$,
                           tests.id('prop1b'), tests.id('unit1'))), '23503',
  'moving a unit that has photos to another property -> 23503');
select is(tests.err(format($$update public.units set property_id = %L where id = %L$$,
                           tests.id('prop1b'), tests.id('unit1b'))), null,
  'moving a unit without photos to another property of the same org works (control)');
update public.units set property_id = tests.id('prop1') where id = tests.id('unit1b');

-- ---------------------------------------------------------------------------
-- sync_conflicts: unit of the same org, feed and booking of the same unit
-- ---------------------------------------------------------------------------
create or replace function tests.sc(unit uuid, feed uuid, booking uuid, org uuid default null) returns text
language sql as $$
  select format($f$insert into public.sync_conflicts (organization_id, unit_id, feed_id, booking_id, external_uid,
                                                    conflict_range)
                   values (%L, %L, %L, %L, 'c-1', daterange('2034-01-10', '2034-01-12'))$f$,
                coalesce(org, tests.id('org1')), unit, feed, booking)
$$;
select is(tests.err(tests.sc(tests.id('unit2'), null, null)), '23503',
  'sync_conflict of org1 on a unit of org2 -> 23503');
select is(tests.err(tests.sc(tests.id('unit1'), tests.id('feed1b'), null)), '23503',
  'sync_conflict on unit1 with the feed of unit1b -> 23503');
select is(tests.err(tests.sc(tests.id('unit1'), tests.id('feed2'), null)), '23503',
  'sync_conflict on unit1 with a feed of org2 -> 23503');
select is(tests.err(tests.sc(tests.id('unit1'), null, tests.id('bk_b'))), '23503',
  'sync_conflict on unit1 with a booking of unit1b -> 23503');
select is(tests.err(tests.sc(tests.id('unit1'), tests.id('feed1'), tests.id('bk_ev1'))), null,
  'sync_conflict with feed and booking of its own unit inserts');
select is(tests.err(tests.sc(tests.id('unit1'), tests.id('feed3'), tests.id('bk_dir'))), null,
  'sync_conflict linking a direct booking inserts');
select hasnt_column('public', 'sync_conflicts', 'resolved', 'sync_conflicts.resolved is gone (resolved_at only)');

-- Deleting the booking keeps the conflict, its unit and organization (set null on booking_id only).
delete from public.bookings where id = tests.id('bk_ev1');
select is((select row(booking_id is null, unit_id = tests.id('unit1'), organization_id = tests.id('org1'))::text
             from public.sync_conflicts where feed_id = tests.id('feed1')),
  '(t,t,t)', 'deleting a linked booking nulls only sync_conflicts.booking_id');

-- ---------------------------------------------------------------------------
-- Linked rows cannot change: a feed's provider or unit, a booking's unit
-- ---------------------------------------------------------------------------
select is(tests.err(format($$update public.ical_feeds set provider = 'airbnb' where id = %L$$, tests.id('feed1'))), '23503',
  'changing the provider of a feed with bookings -> 23503');
select is(tests.err(format($$update public.ical_feeds set unit_id = %L where id = %L$$,
                           tests.id('unit1b'), tests.id('feed1'))), '23503',
  'moving a feed with bookings to another unit -> 23503');
select is(tests.err(format($$update public.bookings set unit_id = %L where id = %L$$,
                           tests.id('unit1b'), tests.id('bk_ev2'))), '23503',
  'moving an imported booking to another unit -> 23503');
select is(tests.err(format($$update public.bookings set unit_id = %L where id = %L$$,
                           tests.id('unit1b'), tests.id('bk_dir'))), '23503',
  'moving a booking linked by a sync_conflict to another unit -> 23503');
select is(tests.err(format($$update public.ical_feeds set provider = 'booking' where id = %L$$, tests.id('feed1b'))), '23503',
  'changing the provider of feed1b (one airbnb booking) -> 23503');
delete from public.sync_conflicts where feed_id = tests.id('feed3');
select is(tests.err(format($$update public.ical_feeds set provider = 'airbnb' where id = %L$$, tests.id('feed3'))), null,
  'changing the provider of a feed with no links works (control)');

-- Deleting a feed keeps its bookings (ical_feed_id null, source and external_uid kept) and drops its conflicts.
delete from public.ical_feeds where id = tests.id('feed1');
select is((select row(ical_feed_id is null, source, external_uid, unit_id = tests.id('unit1'))::text
             from public.bookings where id = tests.id('bk_ev2')),
  '(t,booking,ev-2,t)', 'deleting a feed nulls only bookings.ical_feed_id');
select is((select count(*) from public.sync_conflicts where feed_id = tests.id('feed1')), 0::bigint,
  'deleting a feed deletes its sync_conflicts');

-- ---------------------------------------------------------------------------
-- Refund state: status and refunded_amount agree (payments_refund_state_check)
-- ---------------------------------------------------------------------------
create or replace function tests.pay(st text, amount int, refunded int) returns text
language sql as $$
  select format($f$insert into public.payments (organization_id, booking_id, amount, refunded_amount, status, created_at)
                   values (%L, %L, %s, %s, %L, '2035-01-15 12:00+02')$f$,
                tests.id('org1'), tests.id('bk_dir'), amount, refunded, st)
$$;
select is(tests.err(tests.pay('refunded', 10000, 9999)), '23514', 'refunded with less than the amount -> 23514');
select is(tests.err(tests.pay('refunded', 10000, 10001)), '23514', 'refunded_amount above amount -> 23514');
select is(tests.err(tests.pay('refunded', 10000, 10000)), null, 'refunded with the whole amount inserts');
select is(tests.err(tests.pay('partially_refunded', 10000, 0)), '23514', 'partially_refunded with 0 -> 23514');
select is(tests.err(tests.pay('partially_refunded', 10000, 10000)), '23514',
  'partially_refunded with the whole amount -> 23514');
select is(tests.err(tests.pay('partially_refunded', 10000, 1)), null, 'partially_refunded with 1 inserts');
select is(tests.err(tests.pay('succeeded', 10000, 100)), '23514', 'succeeded with a refund -> 23514');
select is(tests.err(tests.pay('pending', 10000, 100)), '23514', 'pending with a refund -> 23514');
select is(tests.err(tests.pay('succeeded', 10000, 0)), null, 'succeeded without refund inserts');

-- Status and amount must change together.
insert into public.payments (organization_id, booking_id, amount, status, stripe_payment_intent_id, created_at)
values (tests.id('org1'), tests.id('bk_dir'), 20000, 'succeeded', 'pi_test_13', '2035-01-15 12:00+02');
select is(tests.err($$update public.payments set status = 'refunded' where stripe_payment_intent_id = 'pi_test_13'$$),
  '23514', 'status -> refunded without refunded_amount -> 23514');
select is(tests.err($$update public.payments set refunded_amount = 5000 where stripe_payment_intent_id = 'pi_test_13'$$),
  '23514', 'refunded_amount set while status stays succeeded -> 23514');
select is(tests.err($$update public.payments set status = 'partially_refunded', refunded_amount = 5000
                      where stripe_payment_intent_id = 'pi_test_13'$$),
  null, 'status and refunded_amount updated together works');

-- ---------------------------------------------------------------------------
-- Revenue: succeeded + partially_refunded, net of the refund (month 2035-03, only these payments)
-- ---------------------------------------------------------------------------
insert into public.payments (organization_id, booking_id, amount, refunded_amount, status, created_at) values
  (tests.id('org1'), tests.id('bk_dir'), 10000, 0,     'succeeded',          '2035-03-10 12:00+02'),
  (tests.id('org1'), tests.id('bk_dir'), 20000, 5000,  'partially_refunded', '2035-03-11 12:00+02'),
  (tests.id('org1'), tests.id('bk_dir'), 30000, 30000, 'refunded',           '2035-03-12 12:00+02'),
  (tests.id('org1'), tests.id('bk_dir'), 40000, 0,     'failed',             '2035-03-13 12:00+02'),
  (tests.id('org1'), tests.id('bk_dir'), 50000, 0,     'pending',            '2035-03-14 12:00+02');
select tests.login(tests.id('user1'));
select is((select revenue_month from public.dashboard_kpis('2035-03-20'::date)), 25000,
  'revenue = succeeded 10000 + partially_refunded (20000 - 5000); refunded, failed, pending excluded');
select tests.login(tests.id('user2'));
select is((select revenue_month from public.dashboard_kpis('2035-03-20'::date)), 0,
  'revenue of org2 does not include org1 payments');
reset role;

-- ---------------------------------------------------------------------------
-- expire_holds() and is_live_booking(): the same boundary (<= now() expired, > now() live).
-- now() is frozen in this transaction, so hold_expires_at = now() is the exact boundary.
-- ---------------------------------------------------------------------------
select ok(public.is_live_booking('hold', now() + interval '1 second'), 'is_live_booking: hold expiring after now is live');
select ok(not public.is_live_booking('hold', now()), 'is_live_booking: hold expiring exactly now is not live');
select ok(not public.is_live_booking('hold', now() - interval '1 second'), 'is_live_booking: past hold is not live');
select ok(public.is_live_booking('confirmed', null) and public.is_live_booking('blocked', null),
  'is_live_booking: confirmed and blocked are live');
select ok(not public.is_live_booking('cancelled', null) and not public.is_live_booking('expired', null),
  'is_live_booking: cancelled and expired are not live');

insert into tests.ctx values
  ('h_eq',     'e1000000-0000-4000-8000-000000000001'),
  ('h_past',   'e1000000-0000-4000-8000-000000000002'),
  ('h_future', 'e1000000-0000-4000-8000-000000000003'),
  ('h_org2',   'e2000000-0000-4000-8000-000000000001');
insert into public.bookings (id, organization_id, unit_id, check_in, check_out, status, source, adults, children,
                             total_amount, hold_expires_at) values
  (tests.id('h_eq'),     tests.id('org1'), tests.id('unit1b'), '2034-05-01', '2034-05-03', 'hold', 'direct', 1, 0, 0, now()),
  (tests.id('h_past'),   tests.id('org1'), tests.id('unit1b'), '2034-05-10', '2034-05-13', 'hold', 'direct', 1, 0, 0,
   now() - interval '1 second'),
  (tests.id('h_future'), tests.id('org1'), tests.id('unit1b'), '2034-05-20', '2034-05-22', 'hold', 'direct', 1, 0, 0,
   now() + interval '1 second'),
  (tests.id('h_org2'),   tests.id('org2'), tests.id('unit2'),  '2034-05-01', '2034-05-03', 'hold', 'direct', 1, 0, 0,
   now() - interval '1 hour'),
  (gen_random_uuid(),    tests.id('org1'), tests.id('unit1'),  '2034-06-01', '2034-06-03', 'hold', 'direct', 1, 0, 0,
   now() - interval '1 minute');

select is((select count(*) from public.bookings
            where unit_id = tests.id('unit1b') and status = 'hold' and not public.is_live_booking(status, hold_expires_at)),
  2::bigint, 'is_live_booking marks exactly 2 holds of unit1b as not live (the boundary one included)');
-- Documented: an expired hold still blocks its dates until expire_holds() runs.
select is(tests.err(format($$insert into public.bookings (organization_id, unit_id, check_in, check_out, status, source,
                               adults, children, total_amount) values (%L, %L, '2034-05-11', '2034-05-12', 'confirmed',
                               'direct', 1, 0, 0)$$, tests.id('org1'), tests.id('unit1b'))), '23P01',
  'an expired hold not yet released still blocks its dates (23P01)');

-- Expected for user1's global call: every org1 hold that is due (seed holds included, if any are due).
select set_config('tests.org1_due', (select count(*) from public.bookings
  where organization_id = tests.id('org1') and status = 'hold' and hold_expires_at <= now()
    and unit_id <> tests.id('unit1b'))::text, true);

select tests.login(tests.id('user1'));
select is(public.expire_holds(tests.id('unit1b')), 2, 'expire_holds(unit1b) as owner returns 2');
select is((select array_agg(status::text order by check_in) from public.bookings
            where id in (tests.id('h_eq'), tests.id('h_past'), tests.id('h_future'))),
  array['expired', 'expired', 'hold'], 'boundary hold (= now) and past hold expired; future hold kept');
select is(public.expire_holds(tests.id('unit1b')), 0, 'expire_holds is idempotent (second call returns 0)');
select is(tests.err(format($$insert into public.bookings (organization_id, unit_id, check_in, check_out, status, source,
                               adults, children, total_amount) values (%L, %L, '2034-05-11', '2034-05-12', 'confirmed',
                               'direct', 1, 0, 0)$$, tests.id('org1'), tests.id('unit1b'))), null,
  'after expire_holds the dates of the released hold are free');
select is(public.expire_holds(), current_setting('tests.org1_due')::int,
  'expire_holds() as owner releases exactly the due holds of the own organization');
reset role;
select is((select status::text from public.bookings where id = tests.id('h_org2')), 'hold',
  'expire_holds() as org1 owner does not touch a due hold of org2 (RLS)');

select ok(current_setting('tests.org1_due')::int >= 1, 'precondition: org1 has a due hold outside unit1b');
-- As service_role (the webhook / cron role, bypasses RLS). The result is kept in a setting so the
-- assertion runs as postgres again.
select set_config('role', 'service_role', true);
select set_config('tests.svc_n', public.expire_holds()::text, true);
reset role;
select is(current_setting('tests.svc_n')::int, 1, 'expire_holds() as service_role releases the due hold of org2');
select is((select status::text from public.bookings where id = tests.id('h_org2')), 'expired',
  'the due hold of org2 is expired after the service_role call');

-- ---------------------------------------------------------------------------
-- Deletes: a unit with bookings is refused, a whole organization goes
-- ---------------------------------------------------------------------------
select is(tests.err(format($$delete from public.units where id = %L$$, tests.id('unit1'))), '23503',
  'deleting a unit that has bookings -> 23503');
select ok(exists (select 1 from public.units where id = tests.id('unit1')), 'the unit is still there');

-- org1 now has properties, units, prices, photos, feeds, guests, bookings, payments, sync_conflicts.
insert into public.sync_conflicts (organization_id, unit_id, feed_id, booking_id, external_uid, conflict_range)
values (tests.id('org1'), tests.id('unit1b'), tests.id('feed1b'), tests.id('bk_b'), 'c-9', daterange('2034-02-10', '2034-02-12'));
select is(tests.err(format($$delete from public.organizations where id = %L$$, tests.id('org1'))), null,
  'deleting an organization with bookings, payments, feeds and conflicts works');
select is_empty(format($$
  select t from tests.org_tables() t
  where tests.cnt(format('select 1 from public.%%I where organization_id = %%L', t, %L::uuid)) <> 0
$$, tests.id('org1')), 'no row of the deleted organization is left in any table');
select is((select count(*) from public.bookings where organization_id = tests.id('org2')) > 0, true,
  'org2 bookings are untouched');

select * from finish();
rollback;
