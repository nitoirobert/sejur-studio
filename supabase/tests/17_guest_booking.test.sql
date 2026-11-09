-- Brief 07 (0013): the guest's link to his requests, my_bookings, favorites, the host's pending list
-- and badge, the IP rate-limit counter. The dev project holds real accounts and bookings, so every
-- count is a delta or is scoped to the rows this file creates (its own unit, its own accounts).
begin;
\ir _lib/helpers.psql
select * from no_plan();

-- ---------------------------------------------------------------------------
-- Fixtures: two guest accounts (no organization, 0012), a published unit of our own in prop1.
-- ---------------------------------------------------------------------------
insert into tests.ctx values
  ('ga', '00000000-0000-4000-a000-0000000017a1'),
  ('gb', '00000000-0000-4000-a000-0000000017b2'),
  ('ghost', '00000000-0000-4000-a000-0000000017c3'),
  ('u17', '00000000-0000-4000-a000-000000001701');

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
  (tests.id('ga'), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pgtap17-a@example.com', '{"full_name":"Oaspete A","account_type":"guest"}', '{"provider":"email","providers":["email"]}', now(), now()),
  (tests.id('gb'), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pgtap17-b@example.com', '{"full_name":"Oaspete B","account_type":"guest"}', '{"provider":"email","providers":["email"]}', now(), now());

insert into public.units (id, organization_id, property_id, name, type, max_guests, is_published)
values (tests.id('u17'), tests.id('org1'), tests.id('prop1'), 'pgTAP 17', 'camera', 4, true);
insert into public.unit_prices (organization_id, unit_id, kind, price_per_night)
values (tests.id('org1'), tests.id('u17'), 'base', 30000);

create or replace function tests.today() returns date
language sql stable security definer set search_path = '' as $$ select public.bucharest_today() $$;
-- Stay k: two nights starting today + 40 + 3k (our own unit, so nothing else is booked there).
create or replace function tests.d(k integer) returns date
language sql stable as $$ select tests.today() + 40 + 3 * k $$;

create table tests.res (tag text, booking_id uuid, public_token uuid, total bigint, hold_expires_at timestamptz);
grant select, insert on tests.res to anon, authenticated;
create or replace function tests.book(tag text, k integer, em text default 'pgtap17@example.com')
returns text
language plpgsql as $$
begin
  insert into tests.res select tag, r.* from public.create_public_booking(
    tests.id('u17'), tests.d(k), tests.d(k) + 2, 'Oaspete Test', em, '+40 712 345 678', 2, 0) r;
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
create or replace function tests.bid(t text) returns uuid
language sql stable security definer set search_path = '' as $$ select booking_id from tests.res where tag = t $$;
create or replace function tests.msg(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlerrm;
end $$;
grant execute on all functions in schema tests to anon, authenticated;

-- ===========================================================================
-- Checks 11, 12: one create_public_booking, linked only through auth.uid()
-- ===========================================================================
select is((select count(*) from pg_proc where proname = 'create_public_booking'), 1::bigint,
  'one create_public_booking in pg_proc');
select is((select array_to_string(proargnames, ',') from pg_proc
            where proname = 'create_public_booking'),
  'p_unit_id,p_check_in,p_check_out,p_full_name,p_email,p_phone,p_adults,p_children,booking_id,public_token,total,hold_expires_at',
  'create_public_booking: no user parameter (same 8 inputs, same 4 outputs)');
select ok((select prosecdef and proconfig = array['search_path=""'] from pg_proc where proname = 'create_public_booking'),
  'create_public_booking stays security definer with search_path = ''''');

-- anon, with guest A's email: created, linked to nobody
select tests.login_anon();
select is(tests.book('anon_x', 0, 'pgtap17-a@example.com'), 'ok', 'anon creates a request (no account)');
reset role;
select is((select user_id from public.bookings where id = tests.bid('anon_x')), null::uuid,
  'anon request: user_id is null');

-- guest A, with guest B's email
select tests.login(tests.id('ga'));
select is(tests.book('a_as_b', 1, 'pgtap17-b@example.com'), 'ok', 'guest A creates a request with B''s email');
select is(tests.book('a_own', 2, 'pgtap17-a@example.com'), 'ok', 'guest A creates a request with his own email');
reset role;
select is((select user_id from public.bookings where id = tests.bid('a_as_b')), tests.id('ga'),
  'request linked to the caller (A), not to the email''s owner (B)');

-- A sees both of his, not the anon one sent with his email
select tests.login(tests.id('ga'));
select set_eq($$select booking_id from public.my_bookings()$$,
  format($$values (%L::uuid), (%L::uuid)$$, tests.bid('a_as_b'), tests.bid('a_own')),
  'my_bookings(A) = exactly A''s two requests (the anon one on A''s email is not there)');
-- B sees nothing: the request with his email belongs to A
select tests.login(tests.id('gb'));
select is(tests.cnt('select * from public.my_bookings()'), 0::bigint,
  'my_bookings(B) is empty: a request sent by A with B''s email is not B''s');
reset role;

-- a JWT of an account that no longer exists links nothing (no 23503)
select tests.login(tests.id('ghost'));
select is(tests.book('ghost', 3, 'ghost17@example.com'), 'ok', 'request with a token of a missing account works');
reset role;
select is((select user_id from public.bookings where id = tests.bid('ghost')), null::uuid,
  'missing account: user_id stays null');

-- Check 20: the same request twice (double click, two tabs) -> one booking
select tests.login(tests.id('ga'));
select is(tests.book('a_twice', 2, 'pgtap17-a@example.com'), 'unavailable', 'same request again -> unavailable');
reset role;
select is((select count(*) from public.bookings where unit_id = tests.id('u17') and check_in = tests.d(2)), 1::bigint,
  'double submit leaves one booking');

-- ===========================================================================
-- Check 14: my_bookings
-- ===========================================================================
select tests.login_anon();
select is(tests.err('select * from public.my_bookings()'), '42501', 'anon cannot call my_bookings (42501)');
reset role;

-- owner1 as a guest: only his own request, not his organization's bookings
select tests.login(tests.id('user1'));
select is(tests.book('o1', 4, 'owner1-guest17@example.com'), 'ok', 'owner1 sends a request as a guest');
select set_eq($$select booking_id from public.my_bookings()$$, format($$values (%L::uuid)$$, tests.bid('o1')),
  'my_bookings(owner1) = only his request, not the org1 bookings he sees as host');
reset role;

select is((select array_agg(a::text order by n) from pg_proc p,
                  unnest(p.proargnames, p.proargmodes) with ordinality as x(a, m, n)
            where p.proname = 'my_bookings' and m = 't'),
  array['booking_id', 'public_token', 'status', 'check_in', 'check_out', 'unit_id', 'unit_name', 'property_name',
        'city', 'adults', 'children', 'total_amount', 'currency', 'hold_expires_at', 'created_at', 'total_count'],
  'my_bookings columns: no checkin_instructions, organization_id, guest_id, user_id or contact data');

-- expired hold, not swept yet -> expired
update public.bookings set hold_expires_at = now() - interval '1 minute' where id = tests.bid('a_own');
select tests.login(tests.id('ga'));
select is((select status::text from public.my_bookings() where booking_id = tests.bid('a_own')), 'expired',
  'my_bookings: a due hold reads as expired');
select is((select status::text from public.my_bookings() where booking_id = tests.bid('a_as_b')), 'hold',
  'my_bookings: a live hold reads as hold');

-- pagination
select is((select count(*) || '|' || max(total_count) from public.my_bookings(1, 0)), '1|2',
  'my_bookings(1, 0): one row, total_count 2');
select isnt((select booking_id from public.my_bookings(1, 0)), (select booking_id from public.my_bookings(1, 1)),
  'my_bookings(1, 1) is the other row');
select is((select booking_id from public.my_bookings(1, 0)),
  (select booking_id from public.my_bookings() order by created_at desc, booking_id desc limit 1),
  'my_bookings: newest first');
select is(tests.msg('select * from public.my_bookings(0, 0)'), 'invalid_page', 'my_bookings limit 0 -> invalid_page');
select is(tests.msg('select * from public.my_bookings(101, 0)'), 'invalid_page', 'my_bookings limit 101 -> invalid_page');
select is(tests.msg('select * from public.my_bookings(20, -1)'), 'invalid_page', 'my_bookings offset -1 -> invalid_page');
select is(tests.err('select * from public.my_bookings(0, 0)'), '22023', 'invalid_page is 22023');
reset role;

-- ===========================================================================
-- Check 3 / 15: no guest policy on bookings or guests; the link column is not writable
-- ===========================================================================
select set_eq($$select tablename || '.' || policyname from pg_policies
                where schemaname = 'public' and tablename in ('bookings', 'guests')$$,
  array['bookings.bookings_owner', 'guests.guests_owner'],
  'bookings and guests keep only their owner policies (no guest policy)');
select tests.login(tests.id('ga'));
select is(tests.cnt(format('select 1 from public.bookings where id = %L', tests.bid('a_as_b'))), 0::bigint,
  'guest A reads 0 rows from bookings directly, even his own request');
select is(tests.cnt('select 1 from public.guests'), 0::bigint, 'guest A reads 0 rows from guests');
select tests.login(tests.id('gb'));
select is(tests.cnt('select 1 from public.bookings'), 0::bigint, 'guest B reads 0 rows from bookings');
select tests.login_anon();
select ok(tests.cnt('select 1 from public.bookings') <= 0, 'anon reads no bookings');
reset role;

select ok(not has_column_privilege('authenticated', 'public.bookings', 'user_id', 'insert')
          and not has_column_privilege('authenticated', 'public.bookings', 'user_id', 'update')
          and not has_column_privilege('anon', 'public.bookings', 'user_id', 'insert')
          and not has_column_privilege('anon', 'public.bookings', 'user_id', 'update'),
  'no API role (anon, authenticated) can insert or update bookings.user_id');
select ok(has_column_privilege('authenticated', 'public.bookings', 'status', 'update')
          and has_column_privilege('authenticated', 'public.bookings', 'total_amount', 'insert'),
  'owners keep insert / update on the other booking columns');
select tests.login(tests.id('user1'));
select is(tests.err(format('update public.bookings set user_id = %L where id = %L', tests.id('gb'), tests.bid('anon_x'))),
  '42501', 'owner1 cannot set user_id on his own booking (42501)');
select is(tests.err(format($$insert into public.bookings (organization_id, unit_id, check_in, check_out, status, source,
    adults, children, total_amount, user_id)
  values (%L, %L, %L, %L, 'confirmed', 'direct', 1, 0, 0, %L)$$,
  tests.id('org1'), tests.id('u17'), tests.d(9), tests.d(9) + 1, tests.id('gb'))), '42501',
  'owner1 cannot insert a booking with user_id (42501)');
select is(tests.rows(format('update public.bookings set adults = adults where id = %L', tests.bid('anon_x'))), 1::bigint,
  'owner1 still updates other columns of his booking (control)');
select is(tests.msg(format($$select public.create_manual_booking(%L, %L, %L, 'Manual 17', 'm17@example.com', null, 2, 0, 1000)$$,
  tests.id('u17'), tests.d(10), tests.d(10) + 1)), null, 'create_manual_booking still works with the column grants');
select tests.login(tests.id('ga'));
select is(tests.rows(format('update public.bookings set user_id = null where id = %L', tests.bid('a_as_b'))), -1::bigint,
  'guest A cannot unlink or relink his request');
reset role;
select is((select user_id from public.bookings where id = tests.bid('a_as_b')), tests.id('ga'), 'link unchanged');

-- ===========================================================================
-- Checks 5, 21, 22: pending_requests / pending_requests_count
-- ===========================================================================
select tests.login_anon();
select is(tests.err('select * from public.pending_requests()'), '42501', 'anon cannot call pending_requests');
select is(tests.err('select public.pending_requests_count()'), '42501', 'anon cannot call pending_requests_count');
reset role;

create table tests.n0 (n integer);
grant select, insert on tests.n0 to authenticated;
select tests.login(tests.id('user1'));
insert into tests.n0 select public.pending_requests_count();
select is((select max(total_count) from public.pending_requests()), (select n from tests.n0)::bigint,
  'badge = list: total_count of pending_requests = pending_requests_count');
select ok(tests.bid('anon_x') in (select booking_id from public.pending_requests(100, 0)),
  'owner1 sees the anon request in the list');
select ok(tests.bid('a_own') not in (select booking_id from public.pending_requests(100, 0)),
  'an expired hold is not in the list');
select is((select guest_name || '|' || guest_email || '|' || guest_phone || '|' || nights_ok
             from (select guest_name, guest_email, guest_phone,
                          (check_out - check_in = 2)::text as nights_ok
                     from public.pending_requests(100, 0) where booking_id = tests.bid('anon_x')) x),
  'Oaspete Test|pgtap17-a@example.com|+40 712 345 678|true', 'list row: guest contact for the host, dates');
reset role;

-- a new request: +1
select tests.login_anon();
select is(tests.book('anon_y', 5, 'pgtap17-y@example.com'), 'ok', 'a new anon request');
select tests.login(tests.id('user1'));
select is(public.pending_requests_count() - (select n from tests.n0), 1, 'badge +1 after a new request');
-- confirm: -1
select is(tests.msg(format('select public.confirm_booking(%L)', tests.bid('anon_y'))), null, 'owner1 confirms');
select is(public.pending_requests_count() - (select n from tests.n0), 0, 'badge -1 after confirming');
select ok(tests.bid('anon_y') not in (select booking_id from public.pending_requests(100, 0)),
  'confirmed request leaves the list');
-- decline after confirm, confirm after decline -> invalid_status (check 21)
select is(tests.msg(format('select public.decline_booking(%L)', tests.bid('anon_y'))), 'invalid_status',
  'decline after confirm -> invalid_status');
select is(tests.msg(format('select public.decline_booking(%L)', tests.bid('anon_x'))), null, 'owner1 declines');
select is(tests.msg(format('select public.confirm_booking(%L)', tests.bid('anon_x'))), 'invalid_status',
  'confirm after decline -> invalid_status');
select is(public.pending_requests_count() - (select n from tests.n0), -1, 'badge -1 after declining');
-- expired hold
select is(tests.msg(format('select public.confirm_booking(%L)', tests.bid('a_own'))), 'hold_expired',
  'confirm of an expired hold -> hold_expired');
select is(tests.msg('select * from public.pending_requests(0, 0)'), 'invalid_page', 'pending_requests limit 0 -> invalid_page');
select is(tests.msg('select * from public.pending_requests(20, -1)'), 'invalid_page', 'pending_requests offset -1 -> invalid_page');
reset role;

-- isolation: owner2 and guests see none of it
select tests.login(tests.id('user2'));
select is(tests.cnt(format('select 1 from public.pending_requests(100, 0) where booking_id = %L', tests.bid('a_as_b'))),
  0::bigint, 'owner2 does not see owner1''s request');
select is(tests.msg(format('select public.confirm_booking(%L)', tests.bid('a_as_b'))), 'booking_not_found',
  'owner2 confirm on owner1''s request -> booking_not_found');
select tests.login(tests.id('ga'));
select is(tests.cnt('select * from public.pending_requests(100, 0)'), 0::bigint, 'a guest account has no pending list');
select is(public.pending_requests_count(), 0, 'a guest account has badge 0');
select is(tests.msg(format('select public.confirm_booking(%L)', tests.bid('a_as_b'))), 'booking_not_found',
  'guest confirm -> booking_not_found (check 23)');
reset role;

select is_empty($$select a from pg_proc p, unnest(p.proargnames) a
                   where p.proname = 'pending_requests' and a in ('public_token', 'user_id', 'guest_id', 'organization_id')$$,
  'pending_requests returns no public_token, user_id, guest_id or organization_id');

-- ===========================================================================
-- Checks 4, 16: favorites
-- ===========================================================================
select ok((select relrowsecurity from pg_class where oid = 'public.favorites'::regclass), 'favorites: RLS on');
select set_eq($$select policyname || ':' || cmd || ':' || (qual is not null) || ':' || (with_check is not null)
                from pg_policies where schemaname = 'public' and tablename = 'favorites'$$,
  array['favorites_select:SELECT:true:false', 'favorites_insert:INSERT:false:true', 'favorites_delete:DELETE:true:false'],
  'favorites: select (USING), insert (WITH CHECK), delete (USING); no update policy');
select ok((select bool_and(coalesce(qual, '') || coalesce(with_check, '') ~ 'user_id = \( SELECT auth\.uid\(\)')
             from pg_policies where schemaname = 'public' and tablename = 'favorites'),
  'every favorites policy is on user_id = (select auth.uid())');
select ok(not has_table_privilege('authenticated', 'public.favorites', 'update')
          and not has_table_privilege('anon', 'public.favorites', 'select,insert,update,delete'),
  'favorites: no update for authenticated, nothing for anon');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.favorites'::regclass and contype = 'u'
                   and pg_get_constraintdef(oid) = 'UNIQUE (user_id, unit_id)'), 'favorites: unique (user_id, unit_id)');
select is((select array_agg(confrelid::regclass::text || ':' || confdeltype::text order by confrelid::regclass::text)
             from pg_constraint where conrelid = 'public.favorites'::regclass and contype = 'f'),
  array['auth.users:c', 'units:c'], 'favorites: cascade on account and unit deletion');
select ok(exists (select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
                   where i.indrelid = 'public.favorites'::regclass and a.attname = 'unit_id'), 'favorites: index on unit_id');

select tests.login(tests.id('ga'));
select is(tests.err(format('insert into public.favorites (unit_id) values (%L)', tests.id('unit1b'))), null,
  'guest A adds a favourite (user_id defaults to the caller)');
select is(tests.err(format('insert into public.favorites (unit_id) values (%L)', tests.id('unit1b'))), '23505',
  'the same favourite twice -> 23505');
select is(tests.rows(format('insert into public.favorites (unit_id) values (%L) on conflict (user_id, unit_id) do nothing',
  tests.id('unit1b'))), 0::bigint, 'insert ... on conflict do nothing: no error, no second row (double click)');
select is(tests.cnt('select 1 from public.favorites'), 1::bigint, 'guest A has one favourite');
select is(tests.err(format('insert into public.favorites (user_id, unit_id) values (%L, %L)', tests.id('gb'), tests.id('u17'))),
  '42501', 'guest A cannot add a favourite for B');
select is(tests.err(format('insert into public.favorites (unit_id) values (%L)', tests.id('unit1_unpub'))), '42501',
  'an unpublished unit cannot be a favourite');
select is(tests.err(format('insert into public.favorites (unit_id) values (%L)', tests.id('unit2'))), '42501',
  'a unit of a hidden property cannot be a favourite');
select is(tests.err(format('insert into public.favorites (unit_id) values (%L)', gen_random_uuid())), '42501',
  'a missing unit cannot be a favourite');
select is(tests.err('update public.favorites set unit_id = unit_id'), '42501', 'favorites cannot be updated');
select is(tests.err(format('insert into public.favorites (unit_id) values (%L)', tests.id('u17'))), null,
  'guest A adds a second favourite');

select tests.login(tests.id('gb'));
select is(tests.cnt('select 1 from public.favorites'), 0::bigint, 'guest B sees none of A''s favourites');
select is(tests.rows('delete from public.favorites'), 0::bigint, 'guest B deletes none of A''s favourites');
select is(tests.err(format('insert into public.favorites (unit_id) values (%L)', tests.id('unit1b'))), null,
  'guest B favourites the same unit (own row)');
select tests.login(tests.id('user1'));
select is(tests.cnt(format('select 1 from public.favorites where unit_id in (%L, %L)', tests.id('unit1b'), tests.id('u17'))),
  0::bigint, 'the host does not see who favourited his units');
select tests.login_anon();
select ok(tests.cnt('select 1 from public.favorites') <= 0, 'anon reads no favourites');
select tests.login(tests.id('ga'));
select is(tests.rows(format('delete from public.favorites where unit_id = %L', tests.id('u17'))), 1::bigint,
  'guest A removes a favourite');
select is(tests.cnt('select 1 from public.favorites'), 1::bigint, 'guest A keeps the other one');
reset role;

-- ===========================================================================
-- Check 17: IP rate limit
-- ===========================================================================
select ok(not has_function_privilege('anon', 'public.rate_limit_hit(text, text, integer, integer)', 'execute')
          and not has_function_privilege('authenticated', 'public.rate_limit_hit(text, text, integer, integer)', 'execute')
          and has_function_privilege('service_role', 'public.rate_limit_hit(text, text, integer, integer)', 'execute'),
  'rate_limit_hit: service_role only');
select ok(not has_table_privilege(r, t, 'select,insert,update,delete'), r || ' has no access to ' || t)
  from unnest(array['anon', 'authenticated']) r, unnest(array['public.rate_limit_hits', 'public.rate_limit_salt']) t;
select tests.login_anon();
select is(tests.err($$select * from public.rate_limit_hit('public_booking', '203.0.113.7')$$), '42501',
  'anon cannot call rate_limit_hit');
select tests.login(tests.id('ga'));
select is(tests.err($$select * from public.rate_limit_hit('public_booking', '203.0.113.7')$$), '42501',
  'authenticated cannot call rate_limit_hit');
reset role;
select is((select count(*) from public.rate_limit_salt), 1::bigint, 'one salt row');

-- As service_role nothing is asserted (the runner's ok() shim is not visible to it): results go to
-- tables, the assertions run after reset role.
create table tests.rl (n integer, allowed boolean, hits integer, retry integer);
create table tests.out (tag text primary key, v text);
grant usage on schema tests to service_role;
grant all on tests.rl, tests.out to service_role;
grant execute on all functions in schema tests to service_role;

set local role service_role;
-- one call per statement (a lateral call that does not use g would run once)
do $$ begin
  for i in 1..6 loop
    insert into tests.rl select i, r.* from public.rate_limit_hit('pgtap_17', '203.0.113.7') r;
  end loop;
end $$;
reset role;
select is((select string_agg(allowed || ':' || hits, ',' order by n) from tests.rl),
  'true:1,true:2,true:3,true:4,true:5,false:5', 'default 5 per hour: hits 1-5 allowed, the 6th refused');
select ok((select retry between 3500 and 3600 from tests.rl where n = 6), 'refused: retry_after about an hour');
select is((select sum(retry) from tests.rl where n <= 5), 0::bigint, 'allowed: retry_after 0');
select is((select count(*) from public.rate_limit_hits where bucket = 'pgtap_17'), 5::bigint,
  'a refused hit is not stored');
select is_empty($$select 1 from public.rate_limit_hits where key_hash !~ '^[0-9a-f]{64}$' or key_hash like '%203.0.113%'$$,
  'the IP is stored only as a sha256 hex hash');

set local role service_role;
insert into tests.out select 'ip2', allowed::text from public.rate_limit_hit('pgtap_17', ' 203.0.113.8 ');
insert into tests.out select 'bucket2', allowed::text from public.rate_limit_hit('pgtap_17b', '203.0.113.7');
insert into tests.out select 'trim', allowed::text from public.rate_limit_hit('pgtap_17', ' 203.0.113.7 ');
do $$
declare v text[] := '{}';
begin
  for i in 1..3 loop
    v := v || (select r.allowed::text from public.rate_limit_hit('pgtap_17c', '2001:db8::1', 2, 60) r);
  end loop;
  insert into tests.out values ('custom', array_to_string(v, ','));
end $$;
insert into tests.out select 'bad_bucket', tests.err($$select * from public.rate_limit_hit('Bad-Bucket', '1.2.3.4')$$);
insert into tests.out select 'empty_ip', tests.msg($$select * from public.rate_limit_hit('pgtap_17', '  ')$$);
insert into tests.out select 'max0', tests.msg($$select * from public.rate_limit_hit('pgtap_17', '1.2.3.4', 0)$$);
insert into tests.out select 'window', tests.msg($$select * from public.rate_limit_hit('pgtap_17', '1.2.3.4', 5, 86401)$$);
reset role;
select is((select v from tests.out where tag = 'ip2'), 'true', 'another IP is counted apart');
select is((select v from tests.out where tag = 'bucket2'), 'true', 'another bucket is counted apart');
select is((select v from tests.out where tag = 'trim'), 'false', 'the IP is trimmed before hashing (same key)');
select is((select v from tests.out where tag = 'custom'), 'true,true,false', 'parameters passed in: 2 per 60 s');
select is((select v from tests.out where tag = 'bad_bucket'), '22023', 'bad bucket -> 22023');
select is((select v from tests.out where tag = 'empty_ip'), 'invalid_rate_limit', 'empty ip -> invalid_rate_limit');
select is((select v from tests.out where tag = 'max0'), 'invalid_rate_limit', 'max 0 -> invalid_rate_limit');
select is((select v from tests.out where tag = 'window'), 'invalid_rate_limit', 'window over a day -> invalid_rate_limit');

-- the window slides: hits older than the window do not count; rows older than a day are pruned
update public.rate_limit_hits set created_at = now() - interval '61 minutes' where bucket = 'pgtap_17';
insert into public.rate_limit_hits (bucket, key_hash, created_at)
values ('pgtap_17d', repeat('a', 64), now() - interval '25 hours');
set local role service_role;
insert into tests.out select 'slide', allowed::text || ':' || hits from public.rate_limit_hit('pgtap_17', '203.0.113.7');
reset role;
select is((select v from tests.out where tag = 'slide'), 'true:1', 'hits older than the window no longer count');
select is((select count(*) from public.rate_limit_hits where bucket = 'pgtap_17d'), 0::bigint, 'rows older than a day are pruned');
select is((select count(*) from public.rate_limit_hits where bucket = 'pgtap_17'), 7::bigint,
  'rows inside the day are kept (6 old + 1 new)');

-- ===========================================================================
-- Check 4: deleting an account removes its favourites, keeps its bookings (unlinked)
-- ===========================================================================
delete from auth.users where id = tests.id('ga');
select is((select count(*) from public.favorites where user_id = tests.id('ga')), 0::bigint,
  'account deleted -> its favourites are gone (cascade)');
select is((select count(*) || '|' || count(user_id) from public.bookings where id in (tests.bid('a_as_b'), tests.bid('a_own'))),
  '2|0', 'account deleted -> its bookings stay with the host, unlinked');
select is((select count(*) from public.favorites where user_id = tests.id('gb')), 1::bigint, 'B''s favourite untouched');

select * from finish();
rollback;
