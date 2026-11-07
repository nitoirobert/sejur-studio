-- Check 10: anon (Robert's public page) reads only public data, never writes.
begin;
\ir _lib/helpers.psql
select * from no_plan();

-- Fixtures (as postgres): prop1 active, prop2 hidden; unit1 published, unit1b not.
update public.properties set status = 'activa' where id = tests.id('prop1');
update public.properties set status = 'ascunsa' where id = tests.id('prop2');
update public.units set is_published = true where id = tests.id('unit1');
update public.units set is_published = false where id = tests.id('unit1b');
insert into public.bookings (organization_id, unit_id, check_in, check_out, status, source, adults, children, total_amount)
values (tests.id('org1'), tests.id('unit1'), '2033-02-10', '2033-02-14', 'confirmed', 'direct', 2, 0, 70000),
       (tests.id('org1'), tests.id('unit1b'), '2033-02-10', '2033-02-14', 'confirmed', 'direct', 2, 0, 70000);

select tests.login_anon();

-- reads: only active properties, only published units
select is(tests.cnt($$select 1 from public.properties where status::text <> 'activa'$$), 0::bigint,
  'anon sees no property that is not activa');
select is(tests.cnt(format($$select 1 from public.properties where id = %L$$, tests.id('prop1'))), 1::bigint,
  'anon sees an active property');
select ok(tests.cnt(format($$select 1 from public.properties where id = %L$$, tests.id('prop2'))) <= 0,
  'anon does not see a hidden property');
select is(tests.cnt($$select 1 from public.units where not is_published$$), 0::bigint,
  'anon sees no unpublished unit');
select is(tests.cnt(format($$select 1 from public.units where id = %L$$, tests.id('unit1'))), 1::bigint,
  'anon sees a published unit of an active property');
select ok(tests.cnt(format($$select 1 from public.units where property_id = %L$$, tests.id('prop2'))) <= 0,
  'anon sees no unit of a hidden property');
select ok(tests.cnt('select 1 from public.unit_prices') >= 0, 'anon can read unit_prices');
select ok(tests.cnt(format($$select 1 from public.unit_prices where unit_id in (%L, %L)$$,
  tests.id('unit1b'), tests.id('unit2'))) <= 0, 'anon sees no prices of unpublished units or hidden properties');
select ok(tests.cnt('select 1 from public.photos') >= 0, 'anon can read photos');
select ok(tests.cnt(format($$select 1 from public.photos where property_id = %L$$, tests.id('prop2'))) <= 0,
  'anon sees no photos of hidden properties');

-- private tables: 0 rows (or no access at all)
select ok(tests.cnt(format('select 1 from public.%I', t)) <= 0, 'anon reads 0 rows from ' || t)
from unnest(array['guests', 'bookings', 'payments', 'profiles', 'organization_members',
                  'ical_feeds', 'sync_conflicts']) t;
reset role;

-- QA 2: private check-in instructions never readable by anon
select ok(not has_column_privilege('anon', 'public.properties', 'checkin_instructions', 'select'),
  'anon has no select privilege on properties.checkin_instructions');
select tests.login_anon();
select is(tests.err('select checkin_instructions from public.properties'), '42501',
  'anon select of properties.checkin_instructions -> 42501');
select is(tests.err('select * from public.properties'), '42501',
  'anon select * on properties (includes checkin_instructions) -> 42501');
reset role;

-- billing / Stripe columns of organizations not readable by anon
select ok(not has_column_privilege('anon', 'public.organizations', c, 'select'),
  'anon cannot select organizations.' || c)
from unnest(array['legal_name', 'cui', 'reg_com', 'billing_address', 'stripe_account_id']) c;

-- busy ranges: only intervals, no booking details
select is_empty($$
  select a.n from pg_proc p
  cross join lateral unnest(p.proargnames, coalesce(p.proargmodes, '{}'::"char"[])) as a(n, m)
  where p.proname = 'public_busy_ranges' and p.pronamespace = 'public'::regnamespace
    and a.m in ('o', 't')
    and a.n ~ '(guest|status|source|amount|token|name|email|phone|stripe)'
$$, 'public_busy_ranges exposes no guest, status, source, amount or token column');
select tests.login_anon();
select ok(tests.cnt(format($$select * from public.public_busy_ranges(%L::uuid, '2033-02-01'::date, '2033-03-01'::date)$$,
  tests.id('unit1'))) >= 1, 'public_busy_ranges returns the busy interval of a published unit');
select ok(tests.cnt(format($$select * from public.public_busy_ranges(%L::uuid, '2033-02-01'::date, '2033-03-01'::date)$$,
  tests.id('unit1b'))) <= 0, 'public_busy_ranges on an unpublished unit -> error or empty');

-- (b) no history for anon: nothing ending before yesterday (Europe/Bucharest).
-- Other bookings of unit1 are cancelled in this transaction so the fixtures cannot overlap.
reset role;
update public.bookings set status = 'cancelled' where unit_id = tests.id('unit1');
insert into public.bookings (organization_id, unit_id, check_in, check_out, status, source, adults, children, total_amount)
values (tests.id('org1'), tests.id('unit1'), public.bucharest_today() - 6, public.bucharest_today() - 2, 'confirmed', 'direct', 2, 0, 0),
       (tests.id('org1'), tests.id('unit1'), public.bucharest_today() - 2, public.bucharest_today() + 1, 'confirmed', 'direct', 2, 0, 0),
       (tests.id('org1'), tests.id('unit1'), '2020-01-10', '2020-01-14', 'confirmed', 'direct', 2, 0, 0);
-- anon cannot call bucharest_today(), so today is passed in as a setting
select set_config('tests.today', public.bucharest_today()::text, true);
select tests.login_anon();
select is(tests.cnt(format($$select 1 from public.public_busy_ranges(%L::uuid, %L::date, %L::date) where busy_to < %L::date$$,
  tests.id('unit1'), current_setting('tests.today')::date - 30, current_setting('tests.today')::date + 30,
  current_setting('tests.today')::date - 1)), 0::bigint,
  'public_busy_ranges returns no booking ending before yesterday');
select is(tests.cnt(format($$select 1 from public.public_busy_ranges(%L::uuid, %L::date, %L::date)$$,
  tests.id('unit1'), current_setting('tests.today')::date - 30, current_setting('tests.today')::date + 30)), 1::bigint,
  'public_busy_ranges keeps the stay that covers yesterday and today');
select is(tests.cnt(format($$select 1 from public.public_busy_ranges(%L::uuid, '2020-01-01'::date, '2020-03-01'::date)$$,
  tests.id('unit1'))), 0::bigint, 'public_busy_ranges on a past window returns nothing');
reset role;

-- no writes on any public table
reset role;
create or replace function tests.anon_writes() returns table (tbl text, op text, n bigint)
language plpgsql as $$
declare t text; c bigint;
begin
  for t in select * from tests.public_tables() loop
    c := tests.rows(format('update public.%I set id = id', t));
    if c > 0 then tbl := t; op := 'update'; n := c; return next; end if;
    c := tests.rows(format('delete from public.%I', t));
    if c > 0 then tbl := t; op := 'delete'; n := c; return next; end if;
    if tests.err(format('insert into public.%I default values', t)) is null then
      tbl := t; op := 'insert'; n := 1; return next;
    end if;
  end loop;
end $$;
select tests.login_anon();
select is_empty('select * from tests.anon_writes()', 'anon cannot insert, update or delete on any public table');
reset role;

select * from finish();
rollback;
