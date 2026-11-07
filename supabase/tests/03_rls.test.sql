-- Check 3: RLS on every public table, full isolation between org1 and org2.
begin;
\ir _lib/helpers.psql
select * from no_plan();

-- 3a. no public table without RLS
select is_empty($$
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
$$, 'every public table has RLS enabled');

-- Fixtures owned by org2 for tables the seed may leave empty (inserted as postgres).
insert into public.guests (organization_id, full_name, email, phone)
values (tests.id('org2'), 'Oaspete Test Org2', 'oaspete2@example.com', '+40700000002');
insert into public.bookings (organization_id, unit_id, check_in, check_out, status, source, adults, children, total_amount)
values (tests.id('org2'), tests.id('unit2'), '2031-08-01', '2031-08-03', 'confirmed', 'direct', 2, 0, 50000);
insert into public.photos (organization_id, property_id, storage_path, position, is_cover)
values (tests.id('org2'), tests.id('prop2'), tests.id('org2') || '/' || tests.id('prop2') || '/t.webp', 99, false);
insert into public.unit_prices (organization_id, unit_id, kind, price_per_night)
values (tests.id('org2'), tests.id('unit2'), 'weekend', 30000);

-- 3b. snapshots of what each owner sees
select tests.snapshot('all');
select tests.login(tests.id('user1'));
select tests.snapshot('u1');
select tests.login(tests.id('user2'));
select tests.snapshot('u2');
reset role;

select is_empty($$
  select a.tbl, a.id from tests.seen a join tests.seen b on b.tbl = a.tbl and b.id = a.id
  where a.tag = 'u1' and b.tag = 'u2'
$$, 'no row of any public table is visible to both org1 and org2 owners');

select is_empty($$
  select s.tbl, count(*) from tests.seen s
  where s.tag = 'u1' and s.tbl in (select tests.org_tables())
    and not exists (select 1 from tests.seen x where x.tag = 'all' and x.tbl = s.tbl and x.id = s.id)
  group by 1
$$, 'sanity: u1 snapshot is a subset of all rows');

-- every org-scoped row user1 sees belongs to org1
create or replace function tests.foreign_rows_seen() returns table (tbl text, n bigint)
language plpgsql as $$
declare t text; c bigint;
begin
  for t in select * from tests.org_tables() loop
    execute format('select count(*) from public.%I where organization_id <> %L', t, tests.id('org1')) into c;
    if c > 0 then tbl := t; n := c; return next; end if;
  end loop;
end $$;
select tests.login(tests.id('user1'));
select is_empty('select * from tests.foreign_rows_seen()', 'user1 sees no row with organization_id <> org1');
select ok((select count(*) from public.properties) = 2, 'user1 sees own 2 properties (RLS is not deny-all)');
select ok((select count(*) from public.bookings) > 0, 'user1 sees own bookings');
reset role;

-- 3c. update / delete on org2 rows affect 0 rows (every table, via the u2 snapshot)
create or replace function tests.touch_u2(kind text) returns table (tbl text, n bigint)
language plpgsql as $$
declare t text; c bigint;
begin
  for t in select distinct s.tbl from tests.seen s where s.tag = 'u2' loop
    if kind = 'update' then
      c := tests.rows(format('update public.%I set id = id where id::text in
            (select id from tests.seen where tag = ''u2'' and tbl = %L)', t, t));
    else
      c := tests.rows(format('delete from public.%I where id::text in
            (select id from tests.seen where tag = ''u2'' and tbl = %L)', t, t));
    end if;
    if c > 0 then tbl := t; n := c; return next; end if;
  end loop;
end $$;
select tests.login(tests.id('user1'));
select is_empty($$select * from tests.touch_u2('update')$$, 'user1 updates 0 rows of org2 in every table');
select is_empty($$select * from tests.touch_u2('delete')$$, 'user1 deletes 0 rows of org2 in every table');
reset role;
select is((select count(*) from public.properties where id = tests.id('prop2')), 1::bigint,
  'org2 property still exists after user1 delete attempt');

-- 3d. insert into org2 refused on every org-scoped table
create or replace function tests.insert_into(org uuid) returns table (tbl text, state text)
language plpgsql as $$
declare t text; s text;
begin
  for t in select * from tests.org_tables() loop
    s := tests.err(format('insert into public.%I (organization_id) values (%L)', t, org));
    if s is distinct from '42501' then tbl := t; state := coalesce(s, 'inserted'); return next; end if;
  end loop;
end $$;
select tests.login(tests.id('user1'));
select is_empty($$select * from tests.insert_into(tests.id('org2'))$$,
  'user1 insert with organization_id = org2 refused (42501) on every table');

-- 3e. update that moves an own row to org2 refused
reset role;
create or replace function tests.move_to(org uuid) returns table (tbl text, state text)
language plpgsql as $$
declare t text; s text; c bigint;
begin
  for t in select * from tests.org_tables() loop
    execute format('select count(*) from public.%I where organization_id = %L', t, tests.id('org1')) into c;
    continue when c = 0;
    s := tests.err(format('update public.%I set organization_id = %L where organization_id = %L',
                          t, org, tests.id('org1')));
    if s is distinct from '42501' then tbl := t; state := coalesce(s, 'moved'); return next; end if;
  end loop;
end $$;
select tests.login(tests.id('user1'));
select is_empty($$select * from tests.move_to(tests.id('org2'))$$,
  'user1 update moving own rows to org2 refused (42501) on every table');

-- 3f. children under an org2 parent refused even with own organization_id
select is(tests.err(format(
  $$insert into public.units (organization_id, property_id, name, type, max_guests)
    values (%L, %L, 'x', 'apartament', 2)$$, tests.id('org1'), tests.id('prop2'))), '42501',
  'unit under org2 property refused');
select is(tests.err(format(
  $$update public.units set property_id = %L where id = %L$$, tests.id('prop2'), tests.id('unit1'))), '42501',
  'moving own unit under org2 property refused');
select is(tests.err(format(
  $$insert into public.unit_prices (organization_id, unit_id, kind, price_per_night)
    values (%L, %L, 'base', 100)$$, tests.id('org1'), tests.id('unit2'))), '42501',
  'unit_price on org2 unit refused');
select is(tests.err(format(
  $$insert into public.photos (organization_id, property_id, storage_path, position, is_cover)
    values (%L, %L, %L, 0, false)$$, tests.id('org1'), tests.id('prop2'),
    tests.id('org1') || '/' || tests.id('prop2') || '/y.webp')), '42501',
  'photo on org2 property refused');
select is(tests.err(format(
  $$insert into public.bookings (organization_id, unit_id, check_in, check_out, status, source, adults, children, total_amount)
    values (%L, %L, '2031-09-01', '2031-09-02', 'confirmed', 'direct', 1, 0, 0)$$, tests.id('org1'), tests.id('unit2'))), '42501',
  'booking on org2 unit refused');

-- own writes still work (policies are not deny-all)
select is(tests.rows(format($$update public.properties set name = name where id = %L$$, tests.id('prop1'))), 1::bigint,
  'user1 can update own property');
reset role;

select * from finish();
rollback;
