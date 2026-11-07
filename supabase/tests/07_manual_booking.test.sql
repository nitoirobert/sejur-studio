-- Check 7: create_manual_booking (guest + booking in one transaction).
begin;
\ir _lib/helpers.psql
select * from no_plan();

create or replace function tests.mb(unit uuid, ci date, co date, nm text default 'Ion Test') returns text
language sql as $$
  select format($f$select public.create_manual_booking(
      p_unit_id => %L::uuid, p_check_in => %L::date, p_check_out => %L::date,
      p_full_name => %L, p_email => 'ion@example.com', p_phone => '+40700000000',
      p_adults => 2, p_children => 1, p_total_amount => 45050)$f$, unit, ci, co, nm)
$$;

select tests.login(tests.id('user1'));

-- happy path
select is(tests.err(tests.mb(tests.id('unit1'), '2032-03-10', '2032-03-13')), null, 'manual booking created');
select is((select status::text || '/' || source::text from public.bookings
           where unit_id = tests.id('unit1') and check_in = '2032-03-10'), 'confirmed/direct',
  'manual booking is confirmed + direct');
select is((select g.full_name from public.bookings b join public.guests g on g.id = b.guest_id
           where b.unit_id = tests.id('unit1') and b.check_in = '2032-03-10'), 'Ion Test', 'guest linked to booking');
select is((select organization_id from public.bookings where unit_id = tests.id('unit1') and check_in = '2032-03-10'),
  tests.id('org1'), 'booking belongs to the caller org');
select is((select total_amount from public.bookings where unit_id = tests.id('unit1') and check_in = '2032-03-10'),
  45050, 'amount stored in bani');

-- overlap: clear error code, no orphan guest
select is((select count(*) from public.guests where full_name = 'Orfan Test'), 0::bigint, 'precondition: no guest Orfan');
select throws_like(tests.mb(tests.id('unit1'), '2032-03-12', '2032-03-15', 'Orfan Test'), '%booking_overlap%',
  'overlap raises booking_overlap');
select is((select count(*) from public.guests where full_name = 'Orfan Test'), 0::bigint,
  'failed booking leaves no orphan guest');

-- invalid input refused
select isnt(tests.err(tests.mb(tests.id('unit1'), '2032-04-10', '2032-04-10')), null, 'check_out = check_in refused');

-- expired holds of the unit are cleaned first
reset role;
insert into public.bookings (organization_id, unit_id, check_in, check_out, status, source, adults, children,
                             total_amount, hold_expires_at)
values (tests.id('org1'), tests.id('unit1'), '2032-05-01', '2032-05-05', 'hold', 'direct', 2, 0, 1000,
        now() - interval '1 hour');
select tests.login(tests.id('user1'));
select is(tests.err(tests.mb(tests.id('unit1'), '2032-05-02', '2032-05-04', 'Dupa Hold')), null,
  'booking over an expired hold succeeds');
reset role;
select is((select status::text from public.bookings where unit_id = tests.id('unit1') and check_in = '2032-05-01'),
  'expired', 'expired hold was moved to expired');

-- a live hold still blocks
insert into public.bookings (organization_id, unit_id, check_in, check_out, status, source, adults, children,
                             total_amount, hold_expires_at)
values (tests.id('org1'), tests.id('unit1'), '2032-06-01', '2032-06-05', 'hold', 'direct', 2, 0, 1000,
        now() + interval '1 hour');
select tests.login(tests.id('user1'));
select throws_like(tests.mb(tests.id('unit1'), '2032-06-02', '2032-06-04'), '%booking_overlap%',
  'live hold still blocks with booking_overlap');

-- other org unit refused, nothing written
select isnt(tests.err(tests.mb(tests.id('unit2'), '2032-07-01', '2032-07-03', 'Alt Org')), null,
  'unit of another org refused');
reset role;
select is((select count(*) from public.guests where full_name = 'Alt Org'), 0::bigint,
  'no guest written for the refused call');
select is((select count(*) from public.bookings where unit_id = tests.id('unit2') and check_in = '2032-07-01'), 0::bigint,
  'no booking written for the refused call');

select * from finish();
rollback;
