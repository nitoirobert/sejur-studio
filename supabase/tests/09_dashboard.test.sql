-- Check 9: dashboard_chart overlap window + property filter; dashboard_kpis in Europe/Bucharest.
-- Fixtures live in 2033 so the seed (around today) never touches the expected values.
begin;
\ir _lib/helpers.psql
select * from no_plan();

-- Seed KPIs (contract, handover 3): day A, as owner1, computed before any fixture is added.
-- (Seed holds expire 7 days after the seed run: run db:reset:dev right before db:test.)
select tests.login(tests.id('user1'));
select is(
  (select row(arrivals_today, departures_today, occupancy_pct, revenue_month, currency)::text
     from public.dashboard_kpis(tests.day_a())),
  row(3, 1, 31.7::numeric, 808000, 'RON')::text,
  'dashboard_kpis(first day of month) on the seed = arrivals 3, departures 1, occupancy 31.7, revenue 808000');
-- 23:30 UTC on 31 March is 1 April in Bucharest (UTC+3, summer time)
select is(public.bucharest_today('2033-03-31 23:30:00+00'::timestamptz), '2033-04-01'::date,
  'bucharest_today at 23:30 UTC on 31 Mar = 1 Apr');
select is(public.bucharest_today('2033-01-31 23:30:00+00'::timestamptz), '2033-02-01'::date,
  'bucharest_today at 23:30 UTC on 31 Jan = 1 Feb (UTC+2, winter time)');
select throws_ok($$select * from public.dashboard_chart('2033-01-01'::date, '2034-01-03'::date, null)$$,
  '22023', 'invalid_dates', 'dashboard_chart window over 366 days -> invalid_dates');
reset role;

-- unit1c = a unit of prop1b (the second property of org1)
insert into tests.ctx
select 'unit1c', id from public.units where property_id = tests.id('prop1b') order by id limit 1;

insert into public.bookings (id, organization_id, unit_id, check_in, check_out, status, source, adults, children, total_amount)
values
  -- started before the window, ends inside it
  ('00000000-0000-4000-d000-000000000001', tests.id('org1'), tests.id('unit1'),  '2033-03-28', '2033-04-02', 'confirmed', 'direct', 2, 0, 50000),
  -- fully inside
  ('00000000-0000-4000-d000-000000000002', tests.id('org1'), tests.id('unit1b'), '2033-04-03', '2033-04-05', 'confirmed', 'booking', 2, 0, 30000),
  -- other property of org1, inside
  ('00000000-0000-4000-d000-000000000003', tests.id('org1'), tests.id('unit1c'), '2033-04-02', '2033-04-04', 'blocked', 'airbnb', 1, 0, 0),
  -- ends exactly at window start -> excluded ([) semantics)
  ('00000000-0000-4000-d000-000000000004', tests.id('org1'), tests.id('unit1b'), '2033-03-25', '2033-04-01', 'confirmed', 'direct', 2, 0, 10000),
  -- starts exactly at window end -> excluded
  ('00000000-0000-4000-d000-000000000005', tests.id('org1'), tests.id('unit1'),  '2033-04-08', '2033-04-10', 'confirmed', 'direct', 2, 0, 10000),
  -- org2 inside the window -> never visible to org1
  ('00000000-0000-4000-d000-000000000006', tests.id('org2'), tests.id('unit2'),  '2033-04-02', '2033-04-04', 'confirmed', 'direct', 2, 0, 10000);

select tests.login(tests.id('user1'));

-- window [2033-04-01, 2033-04-08)
select set_eq(
  $$select booking_id::text from public.dashboard_chart('2033-04-01'::date, '2033-04-08'::date, null)$$,
  array['00000000-0000-4000-d000-000000000001', '00000000-0000-4000-d000-000000000002',
        '00000000-0000-4000-d000-000000000003'],
  'dashboard_chart returns bookings overlapping [from, to), including ones started before, no org2 rows');
select set_eq(
  format($$select booking_id::text from public.dashboard_chart('2033-04-01'::date, '2033-04-08'::date, %L::uuid)$$,
         tests.id('prop1')),
  array['00000000-0000-4000-d000-000000000001', '00000000-0000-4000-d000-000000000002'],
  'dashboard_chart property filter keeps only that property');
select set_eq(
  format($$select booking_id::text from public.dashboard_chart('2033-04-01'::date, '2033-04-08'::date, %L::uuid)$$,
         tests.id('prop1b')),
  array['00000000-0000-4000-d000-000000000003'],
  'dashboard_chart filter on the other property');

-- KPIs on a fixed day (fixtures only): 2033-04-03
-- arrivals: booking 2 (check_in 04-03); departures: none on 04-03 ... booking 3? no (04-04)
select is((select arrivals_today from public.dashboard_kpis('2033-04-03'::date)), 1,
  'dashboard_kpis: arrivals on 2033-04-03 = 1');
select is((select departures_today from public.dashboard_kpis('2033-04-02'::date)), 1,
  'dashboard_kpis: departures on 2033-04-02 = 1 (booking 1)');

-- Default day = today in Europe/Bucharest (now() is fixed inside the transaction).
select is(
  (select row(k.*)::text from public.dashboard_kpis() k),
  (select row(k.*)::text from public.dashboard_kpis((now() at time zone 'Europe/Bucharest')::date) k),
  'dashboard_kpis() defaults to the Europe/Bucharest day');

-- 23:30 UTC on 31 March 2033 is already 1 April in Bucharest (UTC+3):
-- a payment at that instant counts in April, not March.
reset role;
insert into public.payments (organization_id, booking_id, amount, status, created_at)
values (tests.id('org1'), '00000000-0000-4000-d000-000000000001', 12345, 'succeeded', '2033-03-31 23:30:00+00');
select tests.login(tests.id('user1'));
select is((select revenue_month from public.dashboard_kpis('2033-04-15'::date)), 12345,
  'payment at 23:30 UTC on 31 Mar counts in April (Europe/Bucharest)');
select is((select revenue_month from public.dashboard_kpis('2033-03-15'::date)), 0,
  'and not in March');

-- org2 owner sees nothing of org1 in the window
select tests.login(tests.id('user2'));
select set_eq(
  $$select booking_id::text from public.dashboard_chart('2033-04-01'::date, '2033-04-08'::date, null)$$,
  array['00000000-0000-4000-d000-000000000006'], 'org2 chart shows only org2 bookings');
reset role;

select * from finish();
rollback;
