-- Check 11: guests hold minimal data; deleting a guest keeps the booking.
begin;
\ir _lib/helpers.psql
select plan(5);

select set_eq(
  $$select column_name::text from information_schema.columns where table_schema = 'public' and table_name = 'guests'$$,
  array['id', 'organization_id', 'full_name', 'email', 'phone', 'created_at', 'updated_at'],
  'guests has only id, organization_id, full_name, email, phone and timestamps');

select is((select confdeltype::text from pg_constraint
           where conrelid = 'public.bookings'::regclass and confrelid = 'public.guests'::regclass and contype = 'f'),
  'n', 'bookings.guest_id references guests on delete set null');

insert into public.guests (id, organization_id, full_name, email, phone)
values ('00000000-0000-4000-c000-000000000001', tests.id('org1'), 'Gdpr Test', 'gdpr@example.com', '+40700000011');
insert into public.bookings (organization_id, unit_id, guest_id, check_in, check_out, status, source, adults, children, total_amount)
values (tests.id('org1'), tests.id('unit1'), '00000000-0000-4000-c000-000000000001',
        '2033-09-01', '2033-09-03', 'confirmed', 'direct', 2, 0, 40000);

select is(tests.err($$delete from public.guests where id = '00000000-0000-4000-c000-000000000001'$$), null,
  'guest with a booking can be deleted');
select is((select count(*) from public.bookings where unit_id = tests.id('unit1') and check_in = '2033-09-01'), 1::bigint,
  'booking kept after guest deletion');
select is((select guest_id from public.bookings where unit_id = tests.id('unit1') and check_in = '2033-09-01'), null::uuid,
  'booking.guest_id set to null');

select * from finish();
rollback;
