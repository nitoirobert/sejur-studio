-- Check 5: security definer hygiene, EXECUTE grants, cross-org calls.
begin;
\ir _lib/helpers.psql
select * from no_plan();

select is_empty($$
  select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
$$, 'every public security definer function pins search_path');

-- An empty search_path forces schema-qualified names inside the body.
select is_empty($$
  select p.oid::regprocedure::text, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not (coalesce(p.proconfig, '{}') && array['search_path=""', 'search_path='])
$$, 'every public security definer function uses search_path = '''' (qualified names)');

-- Owner functions: no EXECUTE for PUBLIC or anon; authenticated keeps it.
create or replace function tests.owner_fns() returns setof regprocedure language sql stable as $$
  select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('create_manual_booking', 'reorder_photos', 'dashboard_chart', 'dashboard_kpis')
$$;
select is((select count(distinct pr.proname) from tests.owner_fns() f join pg_proc pr on pr.oid = f), 4::bigint,
  'exactly the 4 owner functions exist (create_manual_booking, reorder_photos, dashboard_chart, dashboard_kpis)');
select is_empty($$
  select f::text from tests.owner_fns() f join pg_proc p on p.oid = f
  where p.proacl is null
     or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')
$$, 'EXECUTE revoked from PUBLIC on owner functions');
select is_empty($$ select f::text from tests.owner_fns() f where has_function_privilege('anon', f, 'execute') $$,
  'anon cannot execute owner functions');
select is_empty($$ select f::text from tests.owner_fns() f where not has_function_privilege('authenticated', f, 'execute') $$,
  'authenticated can execute owner functions');

-- trigger function on auth.users is not callable by API roles
select is_empty($$
  select p.oid::regprocedure::text from pg_trigger t join pg_proc p on p.oid = t.tgfoid
  where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
$$, 'auth.users trigger function not executable by anon/authenticated');

-- public_busy_ranges is the one anon function
select ok(has_function_privilege('anon', (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'public_busy_ranges' limit 1), 'execute'),
  'anon can execute public_busy_ranges');

-- Cross-org calls (user1 with org2 ids): error or empty.
select tests.login(tests.id('user1'));
select ok(tests.cnt(format($$select * from public.dashboard_chart('2020-01-01'::date, '2040-01-01'::date, %L::uuid)$$,
  tests.id('prop2'))) <= 0, 'dashboard_chart with an org2 property -> error or empty');
select isnt(tests.err(format($$select public.create_manual_booking(
    p_unit_id => %L::uuid, p_check_in => '2032-01-10', p_check_out => '2032-01-12',
    p_full_name => 'X', p_email => 'x@example.com', p_phone => null,
    p_adults => 2, p_children => 0, p_total_amount => 1000)$$, tests.id('unit2'))), null,
  'create_manual_booking on an org2 unit -> error');
select isnt(tests.err(format($$select public.reorder_photos(p_property_id => %L::uuid,
    p_photo_ids => array(select id from public.photos where property_id = %L::uuid))$$,
  tests.id('prop2'), tests.id('prop2'))), null, 'reorder_photos on an org2 property -> error');
reset role;

-- anon calls owner functions -> permission denied
select tests.login_anon();
select is(tests.err($$select * from public.dashboard_kpis(current_date)$$), '42501', 'anon cannot call dashboard_kpis');
reset role;

-- (e) default privileges: future tables and functions created by the migration role
-- give nothing to anon (probe objects are rolled back with this transaction).
reset role;
create table public.zz_probe_table (id int);
create function public.zz_probe_fn() returns int language sql set search_path = '' as $$ select 1 $$;
select ok(not has_table_privilege('anon', 'public.zz_probe_table', 'select,insert,update,delete'),
  'default privileges: anon gets nothing on a new public table');
select ok(not has_function_privilege('anon', 'public.zz_probe_fn()', 'execute'),
  'default privileges: anon cannot execute a new public function');
drop function public.zz_probe_fn();
drop table public.zz_probe_table;

select * from finish();
rollback;
