-- Check 6: new auth user -> exactly 1 org + 1 owner membership + 1 profile;
-- metadata cannot pick the org or the role.
begin;
\ir _lib/helpers.psql
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-a000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'nou1@example.com',
   jsonb_build_object('full_name', 'Nou Unu', 'organization_id', tests.id('org1'), 'role', 'admin'),
   '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-a000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'nou2@example.com', '{}'::jsonb, '{}'::jsonb, now(), now());

select is((select count(*) from public.organization_members where user_id = '00000000-0000-4000-a000-0000000000a1'),
  1::bigint, 'new user has exactly 1 membership');
select is((select role::text from public.organization_members where user_id = '00000000-0000-4000-a000-0000000000a1'),
  'owner', 'membership role is owner (metadata role ignored)');
select isnt((select organization_id from public.organization_members where user_id = '00000000-0000-4000-a000-0000000000a1'),
  tests.id('org1'), 'metadata organization_id ignored: user not added to org1');
select is((select count(*) from public.organization_members where organization_id = tests.id('org1')),
  1::bigint, 'org1 still has only its original member');
select is((select count(*) from public.organizations o
           join public.organization_members m on m.organization_id = o.id
           where m.user_id = '00000000-0000-4000-a000-0000000000a1'), 1::bigint, 'exactly 1 organization created');
select is((select count(*) from public.profiles where user_id = '00000000-0000-4000-a000-0000000000a1'),
  1::bigint, 'exactly 1 profile created');
select is((select count(*) from public.organizations), 4::bigint, '2 seed orgs + 2 new orgs');
select isnt(
  (select organization_id from public.organization_members where user_id = '00000000-0000-4000-a000-0000000000a1'),
  (select organization_id from public.organization_members where user_id = '00000000-0000-4000-a000-0000000000a2'),
  'second new account gets a different organization');
select is((select count(*) from public.profiles where user_id = '00000000-0000-4000-a000-0000000000a2'),
  1::bigint, 'second account also gets its profile');

select * from finish();
rollback;
