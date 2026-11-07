-- Check 2: anti-overlap constraint and booking column rules.
-- Dates in 2031 so they never collide with the seed.
begin;
\ir _lib/helpers.psql
select plan(19);

create or replace function tests.bk(unit uuid, ci date, co date, st text default 'confirmed',
                                    amount int default 10000) returns text
language sql as $$
  select format(
    $f$insert into public.bookings (organization_id, unit_id, check_in, check_out, status, source,
                                    adults, children, total_amount)
       select p.organization_id, u.id, %L::date, %L::date, %L, 'direct', 2, 0, %s
       from public.units u join public.properties p on p.id = u.property_id where u.id = %L$f$,
    ci, co, st, amount, unit)
$$;

-- base booking: unit1, [2031-05-10, 2031-05-15)
select is(tests.err(tests.bk(tests.id('unit1'), '2031-05-10', '2031-05-15')), null, 'base confirmed booking inserts');

select is(tests.err(tests.bk(tests.id('unit1'), '2031-05-12', '2031-05-14', 'confirmed')), '23P01',
  'overlap with confirmed on same unit -> 23P01');
select is(tests.err(tests.bk(tests.id('unit1'), '2031-05-14', '2031-05-18', 'hold')), '23P01',
  'overlapping hold on same unit -> 23P01');
select is(tests.err(tests.bk(tests.id('unit1'), '2031-05-01', '2031-05-11', 'blocked')), '23P01',
  'overlapping blocked on same unit -> 23P01');
select is(tests.err(tests.bk(tests.id('unit1b'), '2031-05-10', '2031-05-15')), null,
  'same dates on another unit -> OK');
select is(tests.err(tests.bk(tests.id('unit1'), '2031-05-15', '2031-05-18')), null,
  'check_in = previous check_out (back to back) -> OK');
select is(tests.err(tests.bk(tests.id('unit1'), '2031-05-05', '2031-05-10')), null,
  'check_out = next check_in -> OK');

-- cancelled / expired do not block
select is(tests.err(tests.bk(tests.id('unit1'), '2031-06-01', '2031-06-05', 'cancelled')), null, 'cancelled inserts');
select is(tests.err(tests.bk(tests.id('unit1'), '2031-06-01', '2031-06-05', 'expired')), null,
  'expired over cancelled -> OK');
select is(tests.err(tests.bk(tests.id('unit1'), '2031-06-02', '2031-06-04', 'confirmed')), null,
  'confirmed over cancelled/expired -> OK');

select ok(exists (select 1 from pg_constraint where conname = 'bookings_no_overlap'
                  and conrelid = 'public.bookings'::regclass and contype = 'x'),
  'exclusion constraint bookings_no_overlap exists');

-- invalid rows refused
select is(tests.err(tests.bk(tests.id('unit1'), '2031-07-10', '2031-07-10')), '23514', 'check_out = check_in refused');
select is(tests.err(tests.bk(tests.id('unit1'), '2031-07-10', '2031-07-09')), '23514', 'check_out < check_in refused');
select is(tests.err(tests.bk(tests.id('unit1'), '2031-07-20', '2031-07-22', 'confirmed', -1)), '23514',
  'negative total_amount refused');
select ok(tests.err(tests.bk(tests.id('unit1'), '2031-07-20', '2031-07-22', 'unknown_status')) in ('23514', '22P02'),
  'unknown status refused');
select ok(tests.err(replace(tests.bk(tests.id('unit1'), '2031-07-20', '2031-07-22'), '''direct''', '''fax''')) in ('23514', '22P02'),
  'unknown source refused');

-- defaults and generated stay
select is((select currency::text from public.bookings where unit_id = tests.id('unit1') and check_in = '2031-05-10'),
  'RON', 'currency defaults to RON');
select is((select stay from public.bookings where unit_id = tests.id('unit1') and check_in = '2031-05-10'),
  daterange('2031-05-10', '2031-05-15', '[)'), 'stay = daterange(check_in, check_out, ''[)'')');
select is(tests.err($$update public.bookings set stay = daterange('2031-01-01','2031-01-02')
                      where unit_id = tests.id('unit1') and check_in = '2031-05-10'$$), '428C9',
  'stay is generated (cannot be written)');

select * from finish();
rollback;
