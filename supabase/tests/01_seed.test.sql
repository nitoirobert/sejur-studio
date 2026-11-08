-- Check 1: seed contents (the "db reset twice" half is a command check).
begin;
\ir _lib/helpers.psql
select plan(14);

-- Scoped to the seed accounts and their orgs: the dev DB is shared with the live app,
-- so real signups exist next to the seed and must not change these counts.
select is((select count(*) from auth.users
           where id in (tests.id('user1'), tests.id('user2'))
              or email in ('owner1@example.com', 'owner2@example.com')), 2::bigint,
  'seed: exactly 2 seed accounts (fixed ids, no duplicate owner emails)');
select is((select array_agg(email::text order by email) from auth.users
           where id in (tests.id('user1'), tests.id('user2'))),
  array['owner1@example.com', 'owner2@example.com'], 'seed: every seed account email is @example.com');
select is((select count(*) from public.organizations o
           join public.organization_members m on m.organization_id = o.id
           where m.user_id in (tests.id('user1'), tests.id('user2'))), 2::bigint,
  'seed: exactly 2 seed organizations (one membership per seed owner)');
select isnt(tests.id('org1'), null, 'seed: one organization has exactly 2 properties');
select isnt(tests.id('org2'), null, 'seed: one organization has exactly 1 property');
select isnt(tests.id('org1'), tests.id('org2'), 'seed: org1 and org2 differ');
select isnt(tests.id('user1'), tests.id('user2'), 'seed: each org has its own owner');

select is((select count(*) from public.units u join public.properties p on p.id = u.property_id
           where p.organization_id = tests.id('org1')), 6::bigint, 'seed: org1 has 6 units');

select ok((select count(*) from public.bookings where organization_id = tests.id('org1')) between 15 and 25,
  'seed: org1 has ~20 bookings (15..25)');
select ok((select max(check_out) - min(check_in) from public.bookings
           where organization_id = tests.id('org1')) between 30 and 75,
  'seed: org1 bookings span about 60 days');

select is(
  (select array_agg(distinct source::text order by source::text) from public.bookings
   where organization_id = tests.id('org1') and source::text in ('direct', 'booking', 'airbnb')),
  array['airbnb', 'booking', 'direct'], 'seed: sources direct, booking and airbnb present');
select is(
  (select array_agg(distinct status::text order by status::text) from public.bookings
   where organization_id = tests.id('org1') and status::text in ('confirmed', 'hold', 'blocked')),
  array['blocked', 'confirmed', 'hold'], 'seed: statuses confirmed, hold and blocked present');

select is((select count(*) from public.guests where email is not null and email not like '%@example.com'),
  0::bigint, 'seed: guest emails are fake (@example.com)');
select is((select count(*) from public.profiles where user_id in (tests.id('user1'), tests.id('user2'))),
  2::bigint, 'seed: one profile per seed account');

select * from finish();
rollback;
