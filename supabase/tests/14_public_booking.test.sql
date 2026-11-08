-- Brief 05 checks 1-16: public booking contract (0010), owner confirm / decline, limits, grants, cron,
-- plus the brief 04 functions (reorder_units, save_unit, published unit needs a base price, storage paths).
-- Dates are relative to today (Europe/Bucharest) and chosen by weekday, so the file does not depend on
-- the day it runs. Seed prices used (docs/DB.md): unit 2 (unit1b) base 28000 / weekend 32000 min 1,
-- unit 1 weekend 60000 min 2, unit 4 base 52000 min 2 / weekend 58000 min 2 / season 65000 min 3.
begin;
\ir _lib/helpers.psql
select * from no_plan();

insert into tests.ctx values
  ('unit3', 'b1000000-0000-4000-8000-000000000003'),
  ('unit4', 'b1000000-0000-4000-8000-000000000004'),
  ('unit5', 'b1000000-0000-4000-8000-000000000005');

-- Today in Bucharest, and the first Friday on or after today + 200 + 7k days (free of seed bookings).
create or replace function tests.today() returns date
language sql stable security definer set search_path = '' as $$ select public.bucharest_today() $$;
create or replace function tests.fri(k integer) returns date
language sql stable as $$
  select d + ((5 - extract(isodow from d)::integer + 7) % 7)
    from (select tests.today() + 200 + 7 * k as d) x
$$;

create or replace function tests.qr(u uuid, ci date, co date, a integer default 2, c integer default 0) returns text
language sql as $$ select coalesce(q.reason, 'ok') from public.public_quote(u, ci, co, a, c) q $$;
create or replace function tests.qt(u uuid, ci date, co date, a integer default 2, c integer default 0) returns bigint
language sql as $$ select q.total from public.public_quote(u, ci, co, a, c) q $$;
create or replace function tests.qn(u uuid, ci date, co date, a integer default 2, c integer default 0) returns jsonb
language sql as $$ select q.nightly from public.public_quote(u, ci, co, a, c) q $$;

-- Error message of a statement (null when it succeeds; a successful statement is kept).
create or replace function tests.msg(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlerrm;
end $$;
-- Same, firing the deferred constraint triggers right after the statement.
create or replace function tests.msg_now(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  set constraints all immediate;
  set constraints all deferred;
  return null;
exception when others then
  return sqlerrm;
end $$;

-- create_public_booking: 'ok' or the error message; successful rows are kept in tests.res.
create table tests.res (tag text, booking_id uuid, public_token uuid, total bigint, hold_expires_at timestamptz);
grant select, insert on tests.res to anon, authenticated;
create or replace function tests.book(tag text, u uuid, ci date, co date,
                                      nm text default 'Ana Test', em text default 'ana@example.com',
                                      ph text default '+40721000000', a integer default 2, c integer default 0)
returns text
language plpgsql as $$
begin
  insert into tests.res select tag, r.* from public.create_public_booking(u, ci, co, nm, em, ph, a, c) r;
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
grant execute on all functions in schema tests to anon, authenticated;

-- ===========================================================================
-- Brief 04: save_unit, reorder_units, a published unit needs a base price > 0
-- (first, before anything else queues deferred trigger events)
-- ===========================================================================
select tests.login(tests.id('user1'));
select is(tests.msg_now(format($$select public.save_unit(
    p_property_id => %L, p_name => '  Cameră nouă  ', p_type => 'camera', p_max_guests => 2, p_bedrooms => 1,
    p_beds => 1, p_bathrooms => 1, p_area_m2 => 18, p_description => '  ', p_amenities => '["wifi"]',
    p_is_published => true, p_base_price => 45050)$$, tests.id('prop1'))), null,
  'save_unit creates a published unit with its base price (constraints immediate)');
select is((select u.name || '|' || u.position || '|' || u.is_published || '|' || coalesce(u.description, 'null')
                  || '|' || up.price_per_night
             from public.units u join public.unit_prices up on up.unit_id = u.id and up.kind = 'base'
            where u.property_id = tests.id('prop1') and u.name = 'Cameră nouă'),
  'Cameră nouă|3|true|null|45050', 'save_unit: trimmed name, appended last, blank description null, base price');
insert into tests.ctx select 'unit_new', id from public.units where name = 'Cameră nouă';
select is(tests.msg_now(format($$select public.save_unit(
    p_property_id => %L, p_name => 'Cameră nouă', p_type => 'camera', p_max_guests => 3, p_bedrooms => 1,
    p_beds => 2, p_bathrooms => 1, p_area_m2 => null, p_description => 'D', p_amenities => '[]',
    p_is_published => true, p_base_price => 50000, p_unit_id => %L)$$, tests.id('prop1'), tests.id('unit_new'))), null,
  'save_unit edits the unit and its base price');
select is((select u.max_guests || '|' || up.price_per_night || '|' || (select count(*) from public.unit_prices x
             where x.unit_id = u.id and x.kind = 'base')
             from public.units u join public.unit_prices up on up.unit_id = u.id and up.kind = 'base'
            where u.id = tests.id('unit_new')), '3|50000|1', 'save_unit edit: one base row, new price');
select is(tests.msg(format($$select public.save_unit(%L, 'X', 'vila', 2, 1, 1, 1, null, null, '[]', false, 1000)$$,
  tests.id('prop1'))), 'invalid_unit', 'save_unit: a type outside the enum -> invalid_unit');
select is(tests.msg(format($$select public.save_unit(%L, repeat('a', 81), 'camera', 2, 1, 1, 1, null, null, '[]', false, 1000)$$,
  tests.id('prop1'))), 'invalid_unit', 'save_unit: name over 80 -> invalid_unit');
select is(tests.msg(format($$select public.save_unit(%L, 'X', 'camera', 0, 1, 1, 1, null, null, '[]', false, 1000)$$,
  tests.id('prop1'))), 'invalid_unit', 'save_unit: capacity 0 -> invalid_unit');
select is(tests.msg(format($$select public.save_unit(%L, 'X', 'camera', 2, 1, 1, 1, null, null, '{"a":1}', false, 1000)$$,
  tests.id('prop1'))), 'invalid_unit', 'save_unit: amenities not an array -> invalid_unit');
select is(tests.msg(format($$select public.save_unit(%L, 'X', 'camera', 2, 1, 1, 1, null, null, '[]', false, 0)$$,
  tests.id('prop1'))), 'invalid_price', 'save_unit: base price 0 -> invalid_price');
select is(tests.msg(format($$select public.save_unit(%L, 'X', 'camera', 2, 1, 1, 1, null, null, '[]', false, 2100000001)$$,
  tests.id('prop1'))), 'invalid_price', 'save_unit: base price over 21.000.000 lei -> invalid_price');
select is(tests.msg(format($$select public.save_unit(%L, 'X', 'camera', 2, 1, 1, 1, null, null, '[]', false, 1000, %L)$$,
  tests.id('prop1b'), tests.id('unit_new'))), 'unit_not_found', 'save_unit: a unit of another property -> unit_not_found');
select is(tests.msg(format($$select public.save_unit(%L, 'X', 'camera', 2, 1, 1, 1, null, null, '[]', false, 1000)$$,
  tests.id('prop2'))), 'property_not_found', 'save_unit: owner1 on an org2 property -> property_not_found');

-- the rule holds for direct table writes too
select is(tests.msg_now(format($$insert into public.units (organization_id, property_id, name, type, max_guests, is_published)
  values (%L, %L, 'Fără preț', 'camera', 2, true)$$, tests.id('org1'), tests.id('prop1'))), 'no_price',
  'a unit inserted as published without a base price -> no_price');
select is(tests.msg_now(format($$update public.unit_prices set price_per_night = 0 where unit_id = %L and kind = 'base'$$,
  tests.id('unit_new'))), 'no_price', 'base price 0 on a published unit -> no_price');
select is(tests.msg_now(format($$delete from public.unit_prices where unit_id = %L and kind = 'base'$$,
  tests.id('unit_new'))), 'no_price', 'deleting the base price of a published unit -> no_price');
select is(tests.msg_now(format($$update public.units set is_published = false where id = %L$$, tests.id('unit_new'))), null,
  'unpublishing works');
select is(tests.msg_now(format($$delete from public.unit_prices where unit_id = %L and kind = 'base'$$,
  tests.id('unit_new'))), null, 'an unpublished unit may lose its base price');
select is(tests.msg_now(format($$update public.units set is_published = true where id = %L$$, tests.id('unit_new'))),
  'no_price', 'publishing a unit without a base price -> no_price');
select is(tests.msg(format($$insert into public.units (organization_id, property_id, name, type, max_guests, is_published)
  values (%L, %L, 'Ordinea', 'camera', 2, true);
  insert into public.unit_prices (organization_id, unit_id, kind, price_per_night)
  select organization_id, id, 'base', 1000 from public.units where name = 'Ordinea';
  set constraints all immediate; set constraints all deferred$$, tests.id('org1'), tests.id('prop1'))), null,
  'deferred: published unit first, base price second, same transaction -> accepted');

-- reorder_units
reset role;
create table tests.ord as
  select array(select id from public.units where property_id = tests.id('prop1') order by position desc, name, id) as a;
grant select on tests.ord to authenticated;
select tests.login(tests.id('user1'));
select is(tests.msg(format($$select public.reorder_units(%L, %L::uuid[])$$, tests.id('prop1'), (select a from tests.ord))),
  null, 'reorder_units reverses the order');
select is((select array_agg(position order by position) from public.units where property_id = tests.id('prop1')),
  (select array_agg(i) from generate_series(0, (select count(*)::integer - 1 from public.units
                                                 where property_id = tests.id('prop1'))) i),
  'reorder_units: positions are 0..n-1 without duplicates');
select is((select array_agg(u.id order by u.position) from public.units u where u.property_id = tests.id('prop1')),
  (select a from tests.ord), 'reorder_units: positions follow the given order');
select is(tests.msg(format($$select public.reorder_units(%L, array[%L::uuid])$$, tests.id('prop1'), tests.id('unit1'))),
  'unit_set_mismatch', 'reorder_units with a partial list -> unit_set_mismatch');
select is(tests.msg(format($$select public.reorder_units(%L, array(
    select id from public.units where property_id = %L union all select %L::uuid))$$,
  tests.id('prop1'), tests.id('prop1'), tests.id('unit1'))), 'unit_set_mismatch',
  'reorder_units with a duplicate -> unit_set_mismatch');
select is(tests.msg(format($$select public.reorder_units(%L, array[%L::uuid])$$, tests.id('prop2'), tests.id('unit2'))),
  'property_not_found', 'reorder_units on an org2 property -> property_not_found');

-- storage: own org / own property of that org / <uuid>.webp (0011; names: 15_photos_hardening)
reset role;
create or replace function tests.put(path text) returns text
language plpgsql as $$
begin
  insert into storage.objects (bucket_id, name, owner, metadata)
  values ('photos', path, auth.uid(), '{"size":1000,"mimetype":"image/webp"}');
  return null;
exception when others then
  return sqlstate;
end $$;
select tests.login(tests.id('user1'));
select is(tests.put(tests.id('org1') || '/' || tests.id('prop1') || '/' || gen_random_uuid() || '.webp'), null,
  'storage: <org1>/<prop1>/<uuid>.webp accepted');
select is(tests.put(tests.id('org1') || '/' || tests.id('prop2') || '/' || gen_random_uuid() || '.webp'), '42501',
  'storage: own org with another org''s property refused');
select is(tests.put(tests.id('org1') || '/' || gen_random_uuid() || '/' || gen_random_uuid() || '.webp'), '42501',
  'storage: a property that does not exist refused');
select is(tests.put(tests.id('org1') || '/' || tests.id('prop1') || '/' || gen_random_uuid() || '.png'), '42501', 'storage: not .webp refused');
select is(tests.put(tests.id('org1') || '/' || tests.id('prop1') || '/' || gen_random_uuid() || '/' || gen_random_uuid() || '.webp'), '42501', 'storage: extra segment refused');
select is(tests.put(tests.id('org1') || '/' || tests.id('prop1') || '/../x.webp'), '42501', 'storage: .. refused');
select is(tests.put(tests.id('org2') || '/' || tests.id('prop2') || '/' || gen_random_uuid() || '.webp'), '42501', 'storage: another org refused');
reset role;
set constraints all deferred;

-- ===========================================================================
-- Check 1: season > weekend > base, by weekday
-- ===========================================================================
select tests.login_anon();
select is(extract(isodow from tests.fri(0))::integer, 5, 'precondition: tests.fri() is a Friday');
select is(tests.qt(tests.id('unit1b'), tests.fri(0), tests.fri(0) + 1), 32000::bigint,
  'check-in Friday, 1 night = weekend price');
select is(tests.qt(tests.id('unit1b'), tests.fri(0) + 2, tests.fri(0) + 3), 28000::bigint,
  'check-in Sunday, 1 night = base price');
select is(tests.qn(tests.id('unit1b'), tests.fri(0), tests.fri(0) + 3),
  jsonb_build_object((tests.fri(0))::text, 32000, (tests.fri(0) + 1)::text, 32000, (tests.fri(0) + 2)::text, 28000),
  'Fri-Mon: Friday and Saturday nights weekend, Sunday base (nightly)');
select is((select q.nights || '|' || q.total || '|' || q.currency || '|' || q.ok
             from public.public_quote(tests.id('unit1b'), tests.fri(0), tests.fri(0) + 3, 2, 0) q),
  '3|92000|RON|true', 'Fri-Mon: nights, total, currency, ok');
select is(tests.qr(tests.id('unit1'), tests.fri(0), tests.fri(0) + 1), 'min_nights',
  'unit 1, Friday, 1 night -> min_nights (weekend rule needs 2)');
select is(tests.qt(tests.id('unit1'), tests.fri(0), tests.fri(0) + 2), 120000::bigint,
  'unit 1, Friday, 2 nights = 2 x weekend (control)');
reset role;
create table tests.season as
  select date_from, date_to from public.unit_prices where unit_id = tests.id('unit4') and kind = 'season';
grant select on tests.season to anon;
select tests.login_anon();
select is(tests.qt(tests.id('unit4'), s.f, s.f + 3), 195000::bigint,
  'unit 4 season covers Fri, Sat, Sun: 3 x 65000 (season beats weekend)')
from (select date_from + ((5 - extract(isodow from date_from)::integer + 7) % 7) + 7 as f from tests.season) s;
select is(tests.qn(tests.id('unit4'), s.date_to - 1, s.date_to + 2) ->> (s.date_to - 1)::text, '65000',
  'last season night (date_to - 1) has the season price')
from tests.season s;
select is(tests.qn(tests.id('unit4'), s.date_to - 1, s.date_to + 2) ->> s.date_to::text,
  case when extract(isodow from s.date_to) in (5, 6) then '58000' else '52000' end,
  'the date_to night already has the normal price (exclusive end)')
from tests.season s;

-- ===========================================================================
-- Checks 2, 8, 9: every refusal reason, in order
-- ===========================================================================
select is(tests.qr(gen_random_uuid(), tests.fri(0), tests.fri(0) + 1), 'unit_not_found', 'unknown unit -> unit_not_found');
select is(tests.qr(tests.id('unit1_unpub'), tests.fri(0), tests.fri(0) + 1), 'unit_not_found',
  'unpublished unit -> unit_not_found');
select is(tests.qr(tests.id('unit2'), tests.fri(0), tests.fri(0) + 1), 'unit_not_found',
  'published unit of a hidden property -> unit_not_found');
select is(tests.qr(null, tests.fri(0), tests.fri(0) + 1), 'unit_not_found', 'null unit -> unit_not_found');
select is(tests.qr(tests.id('unit2'), null, null, 0, 0), 'unit_not_found',
  'unit_not_found comes first (bad dates and guests do not change the answer)');
select is(tests.qr(tests.id('unit1b'), tests.today() - 1, tests.today() + 1), 'invalid_dates',
  'check-in before today -> invalid_dates');
select is(tests.qr(tests.id('unit1b'), tests.fri(0), tests.fri(0)), 'invalid_dates', 'check_out = check_in -> invalid_dates');
select is(tests.qr(tests.id('unit1b'), tests.fri(0) + 1, tests.fri(0)), 'invalid_dates', 'check_out < check_in -> invalid_dates');
select is(tests.qr(tests.id('unit1b'), null, tests.fri(0)), 'invalid_dates', 'null check_in -> invalid_dates');
select is(tests.qr(tests.id('unit1b'), tests.fri(0), null), 'invalid_dates', 'null check_out -> invalid_dates');
select is(tests.qr(tests.id('unit1b'), tests.fri(0), tests.fri(0) + 367), 'invalid_dates', '367 nights -> invalid_dates');
select is(tests.qr(tests.id('unit1b'), tests.fri(0), 'infinity'), 'invalid_dates', 'check_out infinity -> invalid_dates (no 22008)');
select is(tests.qr(tests.id('unit1b'), '-infinity', tests.fri(0)), 'invalid_dates', 'check_in -infinity -> invalid_dates');
select is(tests.qr(tests.id('unit1b'), 'infinity', 'infinity'), 'invalid_dates', 'both infinity -> invalid_dates');
select is(tests.qr(tests.id('unit1b'), tests.today() + 731, tests.today() + 732), 'invalid_dates',
  'check-in over 2 years ahead (today + 731) -> invalid_dates');
select is(tests.qr(tests.id('unit1b'), tests.today() + 730, tests.today() + 731), 'ok', 'check-in today + 730 accepted');
select is((select count(*) from jsonb_object_keys(tests.qn(tests.id('unit1b'), tests.fri(0), tests.fri(0) + 2)) k
            where k ~ '^\d{4}-\d{2}-\d{2}$'), 2::bigint, 'nightly keys are YYYY-MM-DD');
set local datestyle = 'SQL, DMY';
select is(tests.qn(tests.id('unit1b'), tests.fri(0), tests.fri(0) + 1) ? to_char(tests.fri(0), 'YYYY-MM-DD'), true,
  'nightly keys stay YYYY-MM-DD under another DateStyle');
reset datestyle;
select is(tests.qr(tests.id('unit1b'), tests.fri(0), tests.fri(0) + 366), 'ok', '366 nights accepted by public_quote');
select is(tests.qr(tests.id('unit1b'), null, null, 0, 0), 'invalid_dates', 'invalid_dates comes before invalid_guest');
select is(tests.qr(tests.id('unit1b'), tests.fri(0), tests.fri(0) + 1, 0, 0), 'invalid_guest', '0 adults -> invalid_guest');
select is(tests.qr(tests.id('unit1b'), tests.fri(0), tests.fri(0) + 1, 21, 0), 'invalid_guest', '21 adults -> invalid_guest');
select is(tests.qr(tests.id('unit1b'), tests.fri(0), tests.fri(0) + 1, 1, -1), 'invalid_guest', 'children -1 -> invalid_guest');
select is(tests.qr(tests.id('unit1b'), tests.fri(0), tests.fri(0) + 1, 1, null), 'invalid_guest', 'children null -> invalid_guest');
select is(tests.qr(tests.id('unit1b'), tests.fri(0), tests.fri(0) + 1, 2, 1), 'too_many_guests',
  'adults + children over max_guests (2) -> too_many_guests');
select is(tests.qr(tests.id('unit1b'), tests.fri(0), tests.fri(0) + 1, 1, 1), 'ok', 'adults + children = max_guests accepted');
select is(tests.qr(tests.id('unit1'), tests.fri(0), tests.fri(0) + 1, 9, 0), 'too_many_guests',
  'too_many_guests comes before min_nights');

-- check-in today is accepted (fixture: nothing live on unit 3 today)
reset role;
update public.bookings set status = 'cancelled'
 where unit_id = tests.id('unit3') and stay && daterange(tests.today(), tests.today() + 1)
   and status in ('hold', 'confirmed', 'blocked');
select tests.login_anon();
select is(tests.qr(tests.id('unit3'), tests.today(), tests.today() + 1), 'ok', 'check-in today accepted');

-- unavailable
reset role;
insert into public.bookings (organization_id, unit_id, check_in, check_out, status, source, total_amount)
values (tests.id('org1'), tests.id('unit1b'), tests.fri(10), tests.fri(10) + 3, 'confirmed', 'direct', 1);
select tests.login_anon();
select is(tests.qr(tests.id('unit1b'), tests.fri(10) + 1, tests.fri(10) + 2), 'unavailable', 'busy days -> unavailable');
select is(tests.qr(tests.id('unit1b'), tests.fri(10) + 3, tests.fri(10) + 4), 'ok', 'the check_out day of a booking is free');
select is((select q.nights is null and q.total is null and q.nightly is null and not q.ok
             from public.public_quote(tests.id('unit1b'), tests.fri(10), tests.fri(10) + 1, 2, 0) q), true,
  'a refusal has null nights, total and nightly');

-- invalid_amount: totals are bigint, never a raw 22003
reset role;
insert into public.unit_prices (organization_id, unit_id, kind, price_per_night, date_from, date_to, priority)
values (tests.id('org1'), tests.id('unit3'), 'season', 2000000000, tests.fri(25), tests.fri(25) + 2, 0);
select tests.login_anon();
select is(tests.qr(tests.id('unit3'), tests.fri(25), tests.fri(25) + 1), 'ok', 'one night at 2.000.000.000 bani is quoted');
select is(tests.msg(format($$select * from public.public_quote(%L, %L, %L, 2, 0)$$,
  tests.id('unit3'), tests.fri(25), tests.fri(25) + 2)), null, 'a total over the integer range raises no error');
select is(tests.qr(tests.id('unit3'), tests.fri(25), tests.fri(25) + 2), 'invalid_amount',
  'a total over the integer range -> invalid_amount');
select is(tests.book('big', tests.id('unit3'), tests.fri(25), tests.fri(25) + 2), 'invalid_amount',
  'create_public_booking over the integer range -> invalid_amount (not 22003)');

-- ===========================================================================
-- Check 11: ties are deterministic (newest created_at wins)
-- ===========================================================================
reset role;
insert into public.unit_prices (organization_id, unit_id, kind, price_per_night, date_from, date_to, priority, created_at)
values (tests.id('org1'), tests.id('unit3'), 'season', 70000, tests.fri(26), tests.fri(26) + 3, 5, '2020-01-01'),
       (tests.id('org1'), tests.id('unit3'), 'season', 60000, tests.fri(26), tests.fri(26) + 3, 4, '2022-01-01'),
       (tests.id('org1'), tests.id('unit3'), 'weekend', 51000, null, null, 0, '2020-01-01');
-- newer rows second: insertion order alone would keep the older ones
-- (one weekend rule per unit since 0011, so only seasons can tie)
insert into public.unit_prices (organization_id, unit_id, kind, price_per_night, date_from, date_to, priority, created_at)
values (tests.id('org1'), tests.id('unit3'), 'season', 81000, tests.fri(26), tests.fri(26) + 3, 5, '2021-01-01');
select tests.login_anon();
select is(tests.qt(tests.id('unit3'), tests.fri(26), tests.fri(26) + 1), 81000::bigint,
  'two seasons, same priority: the newest created_at wins (not insertion order); lower priority loses');
select is(tests.qt(tests.id('unit3'), tests.fri(27), tests.fri(27) + 1), 51000::bigint,
  'the weekend rule prices Friday (one weekend rule per unit, 0011)');
select is(tests.qt(tests.id('unit3'), tests.fri(27) + 2, tests.fri(27) + 3), 45000::bigint,
  'Sunday on the same unit: base (control)');

-- ===========================================================================
-- Check 3: create_public_booking re-prices, no amount parameter, one row per stay
-- ===========================================================================
reset role;
select is((select count(*) from pg_proc where proname = 'create_public_booking'), 1::bigint,
  'create_public_booking has one signature');
select is((select array_to_string(proargnames[1:8], ',') from pg_proc where proname = 'create_public_booking'),
  'p_unit_id,p_check_in,p_check_out,p_full_name,p_email,p_phone,p_adults,p_children',
  'create_public_booking parameters: no amount from the client');
create table tests.q_main as select q.total from public.public_quote(tests.id('unit1b'), tests.fri(1), tests.fri(1) + 3, 1, 1) q;
select tests.login_anon();
select is(tests.book('main', tests.id('unit1b'), tests.fri(1), tests.fri(1) + 3,
                     '  Ana Test  ', '  Ana.Test@Example.com ', ' +40 721 000 000 ', 1, 1), 'ok',
  'anon creates a hold');
select is(tests.book('again', tests.id('unit1b'), tests.fri(1) + 1, tests.fri(1) + 2, 'Ion', 'ion@example.com'),
  'unavailable', 'a second booking on the same days -> unavailable');
reset role;
select is((select count(*) from public.bookings where unit_id = tests.id('unit1b')
            and stay && daterange(tests.fri(1), tests.fri(1) + 3) and status = 'hold'), 1::bigint,
  'exactly one row for the stay');
select is((select b.total_amount::bigint from public.bookings b join tests.res r on r.booking_id = b.id where r.tag = 'main'),
  (select total from tests.q_main), 'saved total = public_quote total (quoted before the booking)');
select is((select r.total from tests.res r where r.tag = 'main'), 92000::bigint, 'returned total = 92000 (Fri, Sat, Sun)');
select is((select b.status || '|' || b.source || '|' || b.adults || '|' || b.children || '|' || (b.hold_expires_at = now() + interval '24 hours')
                  || '|' || (b.hold_expires_at = r.hold_expires_at) || '|' || (b.public_token = r.public_token)
             from public.bookings b join tests.res r on r.booking_id = b.id where r.tag = 'main'),
  'hold|direct|1|1|true|true|true', 'hold, direct, persons, expiry now + 24 h, returned token and expiry match');
select is((select g.full_name || '|' || g.email || '|' || g.phone || '|' || (g.organization_id = tests.id('org1'))
             from public.bookings b join public.guests g on g.id = b.guest_id join tests.res r on r.booking_id = b.id
            where r.tag = 'main'), 'Ana Test|Ana.Test@Example.com|+40 721 000 000|true',
  'guest saved trimmed, in the unit''s organization');

-- Race: a booking that commits after the checks wins the exclusion constraint -> unavailable, no orphan guest.
create or replace function tests.race() returns trigger
language plpgsql as $$
begin
  if new.email = 'race@example.com' then
    insert into public.bookings (organization_id, unit_id, check_in, check_out, status, source, total_amount)
    values (new.organization_id, tests.id('unit1b'), tests.fri(5), tests.fri(5) + 1, 'confirmed', 'direct', 1);
  end if;
  return new;
end $$;
create trigger tests_race before insert on public.guests for each row execute function tests.race();
select tests.login_anon();
select is(tests.qr(tests.id('unit1b'), tests.fri(5), tests.fri(5) + 1), 'ok', 'race: the days are free when checked');
select is(tests.book('race', tests.id('unit1b'), tests.fri(5), tests.fri(5) + 1, em => 'race@example.com'), 'unavailable',
  'race: exclusion_violation on insert -> unavailable');
reset role;
drop trigger tests_race on public.guests;
select is((select count(*) from public.guests where email = 'race@example.com'), 0::bigint, 'race: no guest left behind');
select is((select count(*) from public.bookings where unit_id = tests.id('unit1b') and check_in = tests.fri(5)), 0::bigint,
  'race: no booking left behind');

-- ===========================================================================
-- Checks 8, 9, 15 on create_public_booking
-- ===========================================================================
select tests.login_anon();
select is(tests.book('x', gen_random_uuid(), null, null, '', 'bad', 'abc'), 'unit_not_found',
  'create: unknown unit -> unit_not_found first');
select is(tests.book('x', tests.id('unit1_unpub'), tests.fri(2), tests.fri(2) + 1), 'unit_not_found', 'create: unpublished unit');
select is(tests.book('x', tests.id('unit2'), tests.fri(2), tests.fri(2) + 1), 'unit_not_found', 'create: hidden property');
select is(tests.book('x', tests.id('unit1b'), tests.fri(2), tests.fri(2) + 31), 'invalid_dates', 'create: 31 nights -> invalid_dates');
select is(tests.book('x', tests.id('unit1b'), tests.fri(2), tests.fri(2) + 30, em => 'thirty@example.com'), 'ok',
  'create: 30 nights accepted');
select is(tests.book('x', tests.id('unit1b'), tests.fri(8), tests.fri(8)), 'invalid_dates', 'create: check_out = check_in');
select is(tests.book('x', tests.id('unit1b'), null, tests.fri(8)), 'invalid_dates', 'create: null check_in');
select is(tests.book('x', tests.id('unit1b'), tests.fri(8), 'infinity'), 'invalid_dates', 'create: infinity -> invalid_dates');
select is(tests.book('x', tests.id('unit1b'), tests.fri(8), tests.fri(8) + 1, a => 0), 'invalid_guest', 'create: 0 adults');
select is(tests.book('x', tests.id('unit1b'), tests.fri(8), tests.fri(8) + 1, a => 2, c => 1), 'too_many_guests',
  'create: too many guests');
select is(tests.book('x', tests.id('unit1b'), tests.fri(8), tests.fri(8) + 1, em => 'fără-arond.example.com'), 'invalid_guest',
  'create: email without @ -> invalid_guest');
select is(tests.book('x', tests.id('unit1b'), tests.fri(8), tests.fri(8) + 1, ph => '+40 7ab 000 000'), 'invalid_guest',
  'create: phone with letters -> invalid_guest');
select is(tests.book('x', tests.id('unit1b'), tests.fri(8), tests.fri(8) + 1, ph => null), 'invalid_guest',
  'create: phone required');
select is(tests.book('x', tests.id('unit1b'), tests.fri(8), tests.fri(8) + 1, em => '   '), 'invalid_guest',
  'create: email required (blank after trim)');
select is(tests.book('x', tests.id('unit1b'), tests.fri(8), tests.fri(8) + 1, nm => repeat('a', 81)), 'invalid_guest',
  'create: name over 80 -> invalid_guest');
select is(tests.book('x', tests.id('unit1b'), tests.fri(8), tests.fri(8) + 1, nm => '   '), 'invalid_guest',
  'create: blank name -> invalid_guest');
select is(tests.book('x', tests.id('unit1b'), tests.fri(8), tests.fri(8) + 1, em => repeat('a', 243) || '@example.com'),
  'invalid_guest', 'create: email over 254 -> invalid_guest');
select is(tests.book('x', tests.id('unit1b'), tests.fri(8), tests.fri(8) + 1, ph => '+40 ' || repeat('1', 29)),
  'invalid_guest', 'create: phone over 32 -> invalid_guest');
select is(tests.book('today', tests.id('unit3'), tests.today(), tests.today() + 1, em => 'today@example.com'), 'ok',
  'create: check-in today accepted');

-- ===========================================================================
-- Check 10: an expired hold that was not swept frees the dates; status reads expired
-- ===========================================================================
reset role;
insert into public.bookings (organization_id, unit_id, check_in, check_out, status, source, total_amount, hold_expires_at,
                             public_token)
values (tests.id('org1'), tests.id('unit1b'), tests.fri(15), tests.fri(15) + 2, 'hold', 'direct', 1,
        now() - interval '1 second', 'c0000000-0000-4000-8000-000000000015');
select tests.login_anon();
select is((select status::text from public.public_booking_status('c0000000-0000-4000-8000-000000000015')), 'expired',
  'public_booking_status shows a due hold as expired');
select is(tests.qr(tests.id('unit1b'), tests.fri(15), tests.fri(15) + 2), 'ok', 'public_quote ignores a due hold');
select is(tests.book('over_due', tests.id('unit1b'), tests.fri(15), tests.fri(15) + 2, em => 'due@example.com'), 'ok',
  'create_public_booking over a due hold succeeds (expire_holds runs first)');
reset role;
select is((select status::text from public.bookings where public_token = 'c0000000-0000-4000-8000-000000000015'), 'expired',
  'the due hold was moved to expired');

-- ===========================================================================
-- Checks 4, 13: anon cannot reach private data; status shows no contact data
-- ===========================================================================
select tests.login_anon();
select is((select s.status::text || '|' || s.check_in || '|' || s.check_out || '|' || s.property_name || '|' || s.unit_name
                  || '|' || s.total_amount || '|' || s.currency
             from tests.res r, public.public_booking_status(r.public_token::text) s where r.tag = 'main'),
  'hold|' || tests.fri(1) || '|' || (tests.fri(1) + 3) || '|Pensiunea Valea Lină|Cameră dublă cu balcon|92000|RON',
  'public_booking_status: status, dates, names, total');
select is((select count(*) from public.public_booking_status(gen_random_uuid()::text)), 0::bigint, 'wrong token -> no row');
select is(tests.msg($$select * from public.public_booking_status('not-a-uuid')$$), null, 'malformed token raises no error (no 22P02)');
select is((select count(*) from public.public_booking_status('not-a-uuid')), 0::bigint, 'malformed token -> no row');
select is((select count(*) from public.public_booking_status('{c0000000-0000-4000-8000-000000000015}')), 0::bigint,
  'non-canonical uuid text -> no row');
select is((select count(*) from public.public_booking_status(null)), 0::bigint, 'null token -> no row');
reset role;
select is((select array_agg(a order by n) from pg_proc p, unnest(p.proargnames, p.proargmodes) with ordinality as x(a, m, n)
            where p.proname = 'public_booking_status' and x.m = 't'),
  array['status', 'check_in', 'check_out', 'property_name', 'unit_name', 'total_amount', 'currency']::text[],
  'public_booking_status columns: exactly status, dates, names, total, currency');
select is_empty($$select a from pg_proc p, unnest(p.proargnames) a where p.proname = 'public_booking_status'
  and a in ('email', 'phone', 'checkin_instructions', 'organization_id', 'guest_id', 'full_name')$$,
  'public_booking_status has no contact data or ids');

select tests.login_anon();
select is(tests.err(format($$select public.confirm_booking(%L)$$, (select booking_id from tests.res where tag = 'main'))),
  '42501', 'anon cannot call confirm_booking');
select is(tests.err(format($$select public.decline_booking(%L)$$, (select booking_id from tests.res where tag = 'main'))),
  '42501', 'anon cannot call decline_booking');
select is(tests.err(format($$select public.create_manual_booking(%L, %L, %L, 'X')$$,
  tests.id('unit1b'), tests.fri(9), tests.fri(9) + 1)), '42501', 'anon cannot call create_manual_booking');
select is(tests.err($$select * from public.dashboard_chart(current_date, current_date + 1)$$), '42501',
  'anon cannot call dashboard_chart');
select is(tests.err(format($$insert into public.guests (organization_id, full_name) values (%L, 'X')$$, tests.id('org1'))),
  '42501', 'anon cannot insert into guests');
select is(tests.err(format($$insert into public.bookings (organization_id, unit_id, check_in, check_out, status, source)
  values (%L, %L, %L, %L, 'confirmed', 'direct')$$, tests.id('org1'), tests.id('unit1b'), tests.fri(9), tests.fri(9) + 1)),
  '42501', 'anon cannot insert into bookings');
select is(tests.err(format($$update public.bookings set status = 'confirmed' where id = %L$$,
  (select booking_id from tests.res where tag = 'main'))), '42501', 'anon cannot update bookings');
select ok(tests.cnt('select 1 from public.bookings') <= 0, 'anon reads no bookings');
select ok(tests.cnt('select 1 from public.guests') <= 0, 'anon reads no guests');
reset role;

-- ===========================================================================
-- Checks 5, 12: confirm / decline
-- ===========================================================================
reset role;
insert into public.bookings (organization_id, unit_id, check_in, check_out, status, source, total_amount, hold_expires_at,
                             public_token)
values (tests.id('org1'), tests.id('unit1b'), tests.fri(16), tests.fri(16) + 1, 'hold', 'direct', 1, now() + interval '1 hour',
        'c0000000-0000-4000-8000-000000000016'),
       (tests.id('org1'), tests.id('unit1b'), tests.fri(17), tests.fri(17) + 1, 'hold', 'direct', 1, now() + interval '1 hour',
        'c0000000-0000-4000-8000-000000000017'),
       (tests.id('org1'), tests.id('unit1b'), tests.fri(18), tests.fri(18) + 1, 'expired', 'direct', 1, now() - interval '1 hour',
        'c0000000-0000-4000-8000-000000000018');
create table tests.bk as select public_token::text as t, id from public.bookings
 where public_token::text like 'c0000000-0000-4000-8000-0000000000%';
grant select on tests.bk to anon, authenticated;
create or replace function tests.bk(t text) returns uuid language sql stable as $$ select id from tests.bk where bk.t like '%' || $1 $$;

select tests.login(tests.id('user2'));
select is(tests.msg(format($$select public.confirm_booking(%L)$$, tests.bk('16'))), 'booking_not_found',
  'owner2 cannot confirm owner1''s hold');
select is(tests.msg(format($$select public.decline_booking(%L)$$, tests.bk('16'))), 'booking_not_found',
  'owner2 cannot decline owner1''s hold');
select is(tests.msg(format($$select public.confirm_booking(%L)$$, gen_random_uuid())), 'booking_not_found',
  'unknown booking -> booking_not_found');
select tests.login(tests.id('user1'));
select is(tests.msg(format($$select public.confirm_booking(%L)$$, tests.bk('15'))), 'hold_expired',
  'confirm a hold past its expiry (not swept) -> hold_expired');
select is(tests.msg(format($$select public.confirm_booking(%L)$$, tests.bk('18'))), 'hold_expired',
  'confirm an expired booking -> hold_expired');
reset role;
insert into public.bookings (organization_id, unit_id, check_in, check_out, status, source, total_amount, hold_expires_at,
                             public_token)
values (tests.id('org1'), tests.id('unit4'), tests.fri(19), tests.fri(19) + 2, 'hold', 'direct', 1, now() - interval '1 second',
        'c0000000-0000-4000-8000-000000000019');
insert into tests.bk select public_token::text, id from public.bookings where public_token = 'c0000000-0000-4000-8000-000000000019';
select tests.login(tests.id('user1'));
select is(tests.msg(format($$select public.confirm_booking(%L)$$, tests.bk('19'))), 'hold_expired',
  'confirm a row still in status hold but past hold_expires_at -> hold_expired');
reset role;
select is((select status::text from public.bookings where id = tests.bk('19')), 'hold',
  'that row was not swept and stays unchanged');
select tests.login(tests.id('user1'));
select is(tests.msg(format($$select public.confirm_booking(%L)$$, tests.bk('16'))), null, 'owner1 confirms a live hold');
reset role;
select is((select status::text || '|' || coalesce(hold_expires_at::text, 'null') from public.bookings where id = tests.bk('16')),
  'confirmed|null', 'confirmed, hold_expires_at cleared');
select is((select count(*) from public.bookings where id = tests.bk('16') and organization_id = tests.id('org1')), 1::bigint,
  'still owner1''s booking');
select tests.login(tests.id('user1'));
select is(tests.msg(format($$select public.confirm_booking(%L)$$, tests.bk('16'))), 'invalid_status',
  'confirm a confirmed booking -> invalid_status');
select is(tests.msg(format($$select public.decline_booking(%L)$$, tests.bk('16'))), 'invalid_status',
  'decline a confirmed booking -> invalid_status');
select is(tests.msg(format($$select public.decline_booking(%L)$$, tests.bk('17'))), null, 'owner1 declines a hold');
reset role;
select is((select status::text from public.bookings where id = tests.bk('17')), 'cancelled', 'declined hold is cancelled');
select tests.login(tests.id('user1'));
select is(tests.msg(format($$select public.decline_booking(%L)$$, tests.bk('17'))), 'invalid_status',
  'decline a cancelled booking -> invalid_status');
select is(tests.msg(format($$select public.decline_booking(%L)$$, tests.bk('18'))), 'invalid_status',
  'decline an expired booking -> invalid_status');
select is(tests.msg(format($$select public.confirm_booking(%L)$$, (select booking_id from tests.res where tag = 'main'))), null,
  'owner1 confirms the hold anon created');
reset role;

-- ===========================================================================
-- Check 6: anti-abuse limits
-- ===========================================================================
select is((select count(*) from public.bookings b join public.guests g on g.id = b.guest_id
            where b.status = 'hold' and lower(g.email) = 'pgtap-limit@example.com'), 0::bigint,
  'precondition: no hold for pgtap-limit@example.com');
select tests.login_anon();
select is(tests.book('l1', tests.id('unit3'), tests.fri(20), tests.fri(20) + 1, em => 'pgtap-limit@example.com'), 'ok', 'email hold 1');
select is(tests.book('l2', tests.id('unit1b'), tests.fri(21), tests.fri(21) + 1, em => '  PGTAP-LIMIT@example.com'), 'ok',
  'email hold 2 (other unit, other case, spaces)');
select is(tests.book('l3', tests.id('unit3'), tests.fri(22), tests.fri(22) + 1, em => 'Pgtap-Limit@Example.com  '), 'ok', 'email hold 3');
select is(tests.book('l4', tests.id('unit3'), tests.fri(23), tests.fri(23) + 1, em => 'pgtap-limit@EXAMPLE.COM'), 'too_many_requests',
  '4th live hold on the same email -> too_many_requests');
reset role;
select is((select count(*) from public.bookings where unit_id = tests.id('unit3') and check_in = tests.fri(23)), 0::bigint,
  'the refused 4th hold wrote nothing');
update public.bookings set status = 'cancelled' where unit_id = tests.id('unit5') and status = 'hold';
create or replace function tests.fill(n integer) returns integer
language plpgsql as $$
declare ok integer := 0;
begin
  for i in 1..n loop
    if tests.book('u' || i, tests.id('unit5'), tests.fri(40) + 2 * i, tests.fri(40) + 2 * i + 1,
                  em => 'pgtap-unit' || i || '@example.com') = 'ok' then
      ok := ok + 1;
    end if;
  end loop;
  return ok;
end $$;
grant execute on function tests.fill(integer) to anon;
select tests.login_anon();
select is(tests.fill(20), 20, '20 live holds on one unit accepted');
select is(tests.book('u21', tests.id('unit5'), tests.fri(40) + 50, tests.fri(40) + 51, em => 'pgtap-unit21@example.com'),
  'too_many_requests', '21st live hold on the same unit -> too_many_requests');
reset role;

-- ===========================================================================
-- Item 5: create_manual_booking limits
-- ===========================================================================
create or replace function tests.mb(nm text default 'Ion', em text default null, ph text default null,
                                    a integer default 2, c integer default 0, nights integer default 1) returns text
language sql as $$
  select tests.msg(format($f$select public.create_manual_booking(%L, %L, %L, %L, %L, %L, %s, %s, 1000)$f$,
    tests.id('unit1b'), tests.fri(30), tests.fri(30) + nights, nm, em, ph, a, c))
$$;
select tests.login(tests.id('user1'));
select is(tests.mb(nights => 367), 'invalid_dates', 'manual: 367 nights -> invalid_dates');
select is(tests.msg(format($$select public.create_manual_booking(%L, %L, 'infinity', 'Ion')$$, tests.id('unit1b'), tests.fri(30))),
  'invalid_dates', 'manual: check_out infinity -> invalid_dates (no 22008)');
select is(tests.msg(format($$select public.create_manual_booking(%L, '-infinity', %L, 'Ion')$$, tests.id('unit1b'), tests.fri(30))),
  'invalid_dates', 'manual: check_in -infinity -> invalid_dates');
select is(tests.mb(nm => repeat('a', 81)), 'invalid_guest', 'manual: name over 80 -> invalid_guest');
select is(tests.mb(em => repeat('a', 255)), 'invalid_guest', 'manual: email over 254 -> invalid_guest');
select is(tests.mb(ph => repeat('1', 33)), 'invalid_guest', 'manual: phone over 32 -> invalid_guest');
select is(tests.mb(a => 21), 'invalid_guest', 'manual: 21 adults -> invalid_guest');
select is(tests.mb(c => 21), 'invalid_guest', 'manual: 21 children -> invalid_guest');
select is(tests.mb(nights => 366), null, 'manual: 366 nights accepted');
reset role;

-- ===========================================================================
-- Check 14: function privileges
-- ===========================================================================
select is((select array_agg(p.proname::text order by p.proname) from pg_proc p
            where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')),
  array['create_public_booking', 'public_booking_status', 'public_busy_ranges', 'public_quote'],
  'anon executes exactly the 3 public functions and public_busy_ranges');
select is_empty($$select p.oid::regprocedure::text from pg_proc p where p.pronamespace = 'public'::regnamespace
  and (p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0))$$,
  'PUBLIC has EXECUTE on no public function');
select ok(has_function_privilege('authenticated', f, 'execute') and not has_function_privilege('anon', f, 'execute'),
  'only authenticated (not anon) executes ' || f::text)
from unnest(array['public.confirm_booking(uuid)'::regprocedure, 'public.decline_booking(uuid)'::regprocedure,
                  'public.reorder_units(uuid, uuid[])'::regprocedure,
                  'public.save_unit(uuid, text, text, integer, integer, integer, integer, integer, text, jsonb, boolean, integer, uuid)'::regprocedure]) f;
select ok((select p.prosecdef = (p.proname in ('public_quote', 'create_public_booking', 'public_booking_status',
                                               'confirm_booking', 'decline_booking'))
                  and p.proconfig = array['search_path=""']
             from pg_proc p where p.oid = f),
  f::text || ': security as in brief 05, search_path pinned to ''''')
from unnest(array['public.public_quote(uuid, date, date, integer, integer)'::regprocedure,
                  'public.create_public_booking(uuid, date, date, text, text, text, integer, integer)'::regprocedure,
                  'public.public_booking_status(text)'::regprocedure,
                  'public.confirm_booking(uuid)'::regprocedure, 'public.decline_booking(uuid)'::regprocedure,
                  'public.create_manual_booking(uuid, date, date, text, text, text, integer, integer, integer)'::regprocedure,
                  'public.reorder_units(uuid, uuid[])'::regprocedure,
                  'public.save_unit(uuid, text, text, integer, integer, integer, integer, integer, text, jsonb, boolean, integer, uuid)'::regprocedure]) f;
-- cron.* keeps supabase_admin's PUBLIC grant (postgres cannot revoke it); the schema is closed instead.
select ok(not has_schema_privilege('anon', 'cron', 'usage') and not has_schema_privilege('authenticated', 'cron', 'usage'),
  'anon and authenticated have no USAGE on schema cron');
select tests.login_anon();
select is(tests.err($$select cron.schedule('x', '* * * * *', 'select 1')$$), '42501', 'anon cannot call cron.schedule');
select tests.login(tests.id('user1'));
select is(tests.err($$select cron.schedule('x', '* * * * *', 'select 1')$$), '42501', 'authenticated cannot call cron.schedule');
reset role;

-- ===========================================================================
-- Check 16: one cron job, every 5 minutes, not duplicated when scheduled again
-- ===========================================================================
select is((select count(*) from cron.job where jobname = 'expire-holds'), 1::bigint, 'pg_cron has exactly one expire-holds job');
select is((select jobname || '|' || schedule || '|' || command from cron.job where jobname = 'expire-holds'),
  'expire-holds|*/5 * * * *|select public.expire_holds()', 'the job is expire-holds, */5 * * * *, expire_holds()');
select cron.schedule('expire-holds', '*/5 * * * *', 'select public.expire_holds()');
select is((select count(*) from cron.job where jobname = 'expire-holds'), 1::bigint,
  'scheduling expire-holds again (migration re-run) keeps one job');

-- ===========================================================================
-- Check 15: base price 0 / missing -> no_price (last: queues deferred events, never fired)
-- ===========================================================================
update public.unit_prices set price_per_night = 0 where unit_id = tests.id('unit5') and kind = 'base';
select tests.login_anon();
select is(tests.qr(tests.id('unit5'), tests.fri(3), tests.fri(3) + 1), 'no_price', 'base price 0 -> no_price');
reset role;
delete from public.unit_prices where unit_id = tests.id('unit5') and kind = 'base';
select tests.login_anon();
select is(tests.qr(tests.id('unit5'), tests.fri(3), tests.fri(3) + 1), 'no_price', 'no base price -> no_price');
select is(tests.book('np', tests.id('unit5'), tests.fri(3), tests.fri(3) + 1, em => 'np@example.com'), 'no_price',
  'create_public_booking without a base price -> no_price');
reset role;

select * from finish();
rollback;
