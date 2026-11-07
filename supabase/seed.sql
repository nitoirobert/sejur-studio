-- Seed: fake data only (@example.com). Applied after the migrations (`supabase db reset`).
--
-- Accounts (password for both: Parola-Test-123)
--   owner1@example.com  11111111-1111-4111-8111-111111111111  -> org 1 "Pensiunea Valea Lină SRL"
--   owner2@example.com  22222222-2222-4222-8222-222222222222  -> org 2 "Casa Test"
-- The signup trigger creates each organization, owner membership and profile.
--
-- Dates are relative to A = first day of the current month in Europe/Bucharest, so the chart
-- always has data and the KPIs for day A are fixed (see docs/DB.md):
--   dashboard_kpis(A) as owner1 -> arrivals 3, departures 1, occupancy 31.7 %, revenue 808000 bani.

-- ---------------------------------------------------------------------------
-- Auth accounts
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated',
   'authenticated', 'owner1@example.com', extensions.crypt('Parola-Test-123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Ana Popescu"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated',
   'authenticated', 'owner2@example.com', extensions.crypt('Parola-Test-123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Mihai Ionescu"}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111',
   '{"sub":"11111111-1111-4111-8111-111111111111","email":"owner1@example.com","email_verified":true}',
   'email', now(), now(), now()),
  (gen_random_uuid(), '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222',
   '{"sub":"22222222-2222-4222-8222-222222222222","email":"owner2@example.com","email_verified":true}',
   'email', now(), now(), now());

update public.profiles set phone = '+40700000001' where user_id = '11111111-1111-4111-8111-111111111111';
update public.profiles set phone = '+40700000002' where user_id = '22222222-2222-4222-8222-222222222222';

-- ---------------------------------------------------------------------------
-- Catalogue + bookings
-- ---------------------------------------------------------------------------
do $$
declare
  a date := date_trunc('month', now() at time zone 'Europe/Bucharest')::date;
  org1 uuid := (select organization_id from public.organization_members
                where user_id = '11111111-1111-4111-8111-111111111111');
  org2 uuid := (select organization_id from public.organization_members
                where user_id = '22222222-2222-4222-8222-222222222222');
  pol uuid;
  r record;
  g uuid;
  b uuid;
  i integer := 0;
begin
  update public.organizations
     set name = 'Pensiunea Valea Lină SRL', slug = 'valea-lina', legal_name = 'Valea Lină Turism SRL',
         cui = 'RO00000001', reg_com = 'J08/0001/2020', billing_address = 'Str. Test 1, Bran, Brașov'
   where id = org1;
  update public.organizations set name = 'Casa Test', slug = 'casa-test' where id = org2;

  insert into public.cancellation_policies (organization_id, name, rules)
  values (org1, 'Flexibilă', '[{"days_before": 7, "refund_percent": 100}, {"days_before": 2, "refund_percent": 50}]')
  returning id into pol;

  -- org 1: two active properties
  insert into public.properties (id, organization_id, name, slug, description, address, city, lat, lng,
                                 checkin_instructions, cancellation_policy_id, amenities, status)
  values
    ('a1000000-0000-4000-8000-000000000001', org1, 'Pensiunea Valea Lină', 'pensiunea-valea-lina',
     'Pensiune la poalele munților, cu priveliște spre Piatra Craiului.', 'Str. Principală 10', 'Bran, Brașov',
     45.516, 25.36, 'Cheia este în cutia de lângă ușă (date de test).', pol,
     '["wifi", "parking", "breakfast", "view"]', 'activa'),
    ('a1000000-0000-4000-8000-000000000002', org1, 'Vila Olimp', 'vila-olimp',
     'Vilă la 200 m de plajă.', 'Str. Falezei 3', 'Olimp, Constanța',
     43.889, 28.611, 'Recepția este deschisă 08:00-22:00 (date de test).', pol,
     '["wifi", "parking", "sea", "pool"]', 'activa');

  insert into public.units (id, property_id, name, type, max_guests, bedrooms, beds, bathrooms, area_m2,
                            description, amenities, position, is_published)
  values
    ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Căsuța din Brazi',
     'casuta', 4, 2, 3, 1, 48, 'Căsuță din lemn cu șemineu și terasă.',
     '["wifi", "parking", "fireplace", "kitchen", "view", "pets"]', 0, true),
    ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Cameră dublă cu balcon',
     'camera', 2, 1, 1, 1, 22, 'Cameră luminoasă cu balcon spre munte.',
     '["wifi", "parking", "breakfast", "view"]', 1, true),
    ('b1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'Apartament Panoramic',
     'apartament', 4, 2, 2, 1, 58, 'Apartament cu două dormitoare și priveliște panoramică.',
     '["wifi", "parking", "kitchen", "view"]', 2, true),
    ('b1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000002', 'Apartament Panorama Mării',
     'apartament', 4, 2, 2, 1, 60, 'Apartament cu vedere la mare.',
     '["wifi", "ac", "sea", "pool"]', 0, true),
    ('b1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000002', 'Garsonieră Faleză',
     'garsoniera', 2, 1, 1, 1, 30, 'Garsonieră aproape de plajă.',
     '["wifi", "ac", "sea"]', 1, true),
    ('b1000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000002', 'Cameră cu vedere la mare',
     'camera', 2, 1, 1, 1, 20, 'Cameră nepublicată încă (date de test).',
     '["wifi", "ac"]', 2, false);

  insert into public.unit_prices (unit_id, kind, price_per_night, date_from, date_to, min_nights, priority)
  values
    ('b1000000-0000-4000-8000-000000000001', 'base', 52000, null, null, 1, 0),
    ('b1000000-0000-4000-8000-000000000001', 'weekend', 60000, null, null, 2, 10),
    ('b1000000-0000-4000-8000-000000000002', 'base', 28000, null, null, 1, 0),
    ('b1000000-0000-4000-8000-000000000003', 'base', 45000, null, null, 1, 0),
    ('b1000000-0000-4000-8000-000000000004', 'base', 52000, null, null, 2, 0),
    ('b1000000-0000-4000-8000-000000000004', 'season', 65000, make_date(extract(year from a)::int + 1, 7, 1),
     make_date(extract(year from a)::int + 1, 9, 1), 3, 20),
    ('b1000000-0000-4000-8000-000000000005', 'base', 25000, null, null, 1, 0),
    ('b1000000-0000-4000-8000-000000000006', 'base', 30000, null, null, 1, 0);

  -- org 2: one hidden property, one unit
  insert into public.properties (id, organization_id, name, slug, city, status)
  values ('a2000000-0000-4000-8000-000000000001', org2, 'Casa de Oaspeți Test', 'casa-de-oaspeti-test',
          'Sibiu', 'ascunsa');
  insert into public.units (id, property_id, name, type, max_guests, is_published)
  values ('b2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Camera 1',
          'camera', 2, true);
  insert into public.unit_prices (unit_id, kind, price_per_night)
  values ('b2000000-0000-4000-8000-000000000001', 'base', 20000);

  -- Bookings: (unit n, check_in offset, check_out offset, status, source, guest name, amount in bani)
  for r in
    select * from (values
      (1, -8, -3, 'confirmed', 'direct',  'Andrei Pop',       156000),
      (1,  0,  3, 'confirmed', 'direct',  'Maria Ionescu',    156000),
      (1,  5,  9, 'blocked',   'booking', null,                    0),
      (1, 14, 18, 'confirmed', 'direct',  'Radu Stan',        208000),
      (1, 30, 33, 'cancelled', 'direct',  'Elena Dobre',      156000),
      (2, -5,  0, 'confirmed', 'direct',  'Ioana Marin',      140000),
      (2,  2,  6, 'blocked',   'airbnb',  null,                    0),
      (2, 10, 12, 'hold',      'direct',  'Vlad Georgescu',    56000),
      (2, 20, 25, 'confirmed', 'direct',  'Cristina Lungu',   140000),
      (3, -2,  4, 'blocked',   'booking', null,                    0),
      (3,  7, 11, 'confirmed', 'direct',  'Bogdan Matei',     180000),
      (3, 25, 40, 'blocked',   'direct',  null,                    0),
      (4,  0,  2, 'confirmed', 'direct',  'Alina Rusu',        90000),
      (4,  3,  8, 'blocked',   'airbnb',  null,                    0),
      (4, 15, 19, 'confirmed', 'direct',  'Sorin Vasile',     120000),
      (4, 45, 50, 'confirmed', 'direct',  'Diana Toma',       150000),
      (5,-10, -6, 'blocked',   'booking', null,                    0),
      (5,  1,  5, 'confirmed', 'direct',  'Paul Neagu',       100000),
      (5, 12, 14, 'expired',   'direct',  'Laura Florea',      50000),
      (6,  0,  4, 'blocked',   'airbnb',  null,                    0),
      (6,  8, 13, 'confirmed', 'direct',  'George Ilie',      160000),
      (6, 22, 27, 'hold',      'direct',  'Monica Barbu',      80000)
    ) as t(unit_n, ci, co, st, src, guest, amount)
  loop
    i := i + 1;
    g := null;
    if r.guest is not null then
      insert into public.guests (organization_id, full_name, email, phone)
      values (org1, r.guest, 'oaspete' || i || '@example.com', '+4072' || lpad(i::text, 7, '0'))
      returning id into g;
    end if;

    insert into public.bookings (unit_id, guest_id, check_in, check_out, status, source, adults, children,
                                 total_amount, hold_expires_at)
    values (('b1000000-0000-4000-8000-00000000000' || r.unit_n)::uuid, g, a + r.ci, a + r.co,
            r.st::public.booking_status, r.src::public.booking_source, 2, (i % 3 = 0)::int, r.amount,
            case when r.st = 'hold' then now() + interval '7 days' end)
    returning id into b;

    -- Paid 5 days before check-in, at noon Bucharest time.
    if r.st = 'confirmed' then
      insert into public.payments (booking_id, amount, status, stripe_payment_intent_id, created_at)
      values (b, r.amount, 'succeeded', 'pi_test_seed_' || i,
              ((a + (r.ci - 5)) + time '12:00') at time zone 'Europe/Bucharest');
    end if;
  end loop;

  -- org 2: one guest + one booking + payment
  insert into public.guests (organization_id, full_name, email, phone)
  values (org2, 'Oaspete Org Doi', 'oaspete.org2@example.com', '+40700000999')
  returning id into g;
  insert into public.bookings (unit_id, guest_id, check_in, check_out, status, source, adults, total_amount)
  values ('b2000000-0000-4000-8000-000000000001', g, a + 3, a + 6, 'confirmed', 'direct', 2, 60000)
  returning id into b;
  insert into public.payments (booking_id, amount, status, created_at)
  values (b, 60000, 'succeeded', ((a + 1) + time '12:00') at time zone 'Europe/Bucharest');
end
$$;
