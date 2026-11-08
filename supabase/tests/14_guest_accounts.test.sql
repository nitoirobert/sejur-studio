-- Check 14 (0010): conturile de client nu primesc organizație; gazdele rămân ca înainte.
begin;
\ir _lib/helpers.psql
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
  -- client cu email (popup-ul de pe site)
  ('00000000-0000-4000-a000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'client1@example.com', jsonb_build_object('full_name', 'Client Unu', 'account_type', 'guest'),
   '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
  -- client prin Google (numele vine ca „name")
  ('00000000-0000-4000-a000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'client2@example.com', jsonb_build_object('name', 'Client Doi'),
   '{"provider":"google","providers":["google"]}'::jsonb, now(), now()),
  -- gazdă (formularul /cont-nou nu trimite account_type)
  ('00000000-0000-4000-a000-0000000000b3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gazda3@example.com', jsonb_build_object('full_name', 'Gazda Trei'),
   '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
  -- metadata nu poate face din client gazdă cu o organizație străină
  ('00000000-0000-4000-a000-0000000000b4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'client4@example.com', jsonb_build_object('account_type', 'guest', 'organization_id', tests.id('org1'), 'role', 'owner'),
   '{"provider":"email","providers":["email"]}'::jsonb, now(), now());

select is((select count(*) from public.organization_members where user_id = '00000000-0000-4000-a000-0000000000b1'),
  0::bigint, 'email guest: no membership');
select is((select full_name from public.profiles where user_id = '00000000-0000-4000-a000-0000000000b1'),
  'Client Unu', 'email guest: profile with full_name');
select is((select count(*) from public.organization_members where user_id = '00000000-0000-4000-a000-0000000000b2'),
  0::bigint, 'google user: no membership');
select is((select full_name from public.profiles where user_id = '00000000-0000-4000-a000-0000000000b2'),
  'Client Doi', 'google user: name taken from "name"');
select is((select role::text from public.organization_members where user_id = '00000000-0000-4000-a000-0000000000b3'),
  'owner', 'host signup unchanged: owner of a new org');
select is((select count(*) from public.organization_members where user_id = '00000000-0000-4000-a000-0000000000b4'),
  0::bigint, 'guest metadata cannot join an existing org');
select is((select count(*) from public.organization_members where organization_id = tests.id('org1')),
  1::bigint, 'org1 still has only its original member');
select is((select count(*) from public.organizations), 3::bigint, '2 seed orgs + 1 new host org');

select * from finish();
rollback;
