-- Check 12: money as integer >= 0, updated_at triggers, FK/org indexes, section 4b indexes,
-- policies call auth.uid() only through (select ...).
begin;
\ir _lib/helpers.psql
select * from no_plan();

-- money columns: integer + a check constraint (>= 0) on the column
create or replace function tests.money_cols() returns table (tbl text, col text, typ text)
language sql stable as $$
  select c.table_name::text, c.column_name::text, c.data_type::text from information_schema.columns c
  where c.table_schema = 'public' and c.table_name in (select tests.public_tables())
    and c.column_name ~ '(amount|price)' and c.column_name !~ '(_id|_at|_ids)$'
$$;
select ok((select count(*) from tests.money_cols()) >= 4, 'money columns found (amounts and prices)');
select is_empty($$select * from tests.money_cols() where typ <> 'integer'$$, 'every money column is integer');
select is_empty($$
  select m.tbl, m.col from tests.money_cols() m
  where not exists (
    select 1 from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
    where k.conrelid = ('public.' || m.tbl)::regclass and k.contype = 'c' and a.attname = m.col
      and pg_get_constraintdef(k.oid) ~ '>= 0')
$$, 'every money column has a check (>= 0)');

-- every public table has id, created_at, updated_at and a BEFORE UPDATE row trigger
select is_empty($$
  select t from tests.public_tables() t
  where (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = t and column_name in ('id', 'created_at', 'updated_at')) <> 3
$$, 'every public table has id, created_at and updated_at');
select is_empty($$
  select t from tests.public_tables() t
  where not exists (select 1 from pg_trigger g where g.tgrelid = ('public.' || t)::regclass and not g.tgisinternal
                    and (g.tgtype & 1) = 1 and (g.tgtype & 2) = 2 and (g.tgtype & 16) = 16)
$$, 'every public table has a BEFORE UPDATE row trigger (updated_at)');

select ok((select updated_at from public.properties where id = tests.id('prop1')) < now(),
  'precondition: seed updated_at is older than this transaction');
update public.properties set name = name || ' ' where id = tests.id('prop1');
select ok((select updated_at from public.properties where id = tests.id('prop1')) >= now(),
  'updated_at changes on update');

-- every FK column and organization_id lead an index (exclusion constraints count)
create or replace function tests.leading_index(rel regclass, col text) returns boolean
language sql stable as $$
  select exists (select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
                 where i.indrelid = rel and a.attname = col)
$$;
select is_empty($$
  select k.conrelid::regclass::text, a.attname from pg_constraint k
  join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
  where k.contype = 'f' and k.connamespace = 'public'::regnamespace
    and not tests.leading_index(k.conrelid, a.attname::text)
$$, 'every foreign key is the first column of an index');
select is_empty($$
  select t from tests.org_tables() t where not tests.leading_index(('public.' || t)::regclass, 'organization_id')
$$, 'organization_id is the first column of an index on every table that has it');

-- section 4b indexes
create or replace function tests.index_cols(rel regclass) returns setof name[]
language sql stable as $$
  select (select array_agg(a.attname order by u.ord) from unnest(i.indkey::int2[]) with ordinality u(n, ord)
          join pg_attribute a on a.attrelid = i.indrelid and a.attnum = u.n)
  from pg_index i where i.indrelid = rel
$$;
select ok(array['unit_id', 'check_in']::name[] in (select tests.index_cols('public.bookings')),
  'index bookings (unit_id, check_in)');
select ok(exists (select 1 from pg_index i where i.indrelid = 'public.bookings'::regclass and i.indpred is not null
                  and not exists (select 1 from pg_constraint k where k.conindid = i.indexrelid)),
  'partial index on active bookings');
select ok(exists (select 1 from pg_index i join pg_class c on c.oid = i.indexrelid join pg_am am on am.oid = c.relam
                  where i.indrelid = 'public.bookings'::regclass and am.amname = 'gist'),
  'GiST index on bookings.stay (from bookings_no_overlap)');
select ok(array['user_id', 'organization_id']::name[] in (select tests.index_cols('public.organization_members')),
  'index organization_members (user_id, organization_id)');

-- is_org_member is stable security definer
select ok(exists (select 1 from pg_proc where proname = 'is_org_member' and pronamespace = 'public'::regnamespace
                  and provolatile = 's' and prosecdef), 'is_org_member() is stable security definer');

-- policies: auth.uid() only inside (select ...)
select is_empty($$
  select schemaname, tablename, policyname from pg_policies
  where schemaname in ('public', 'storage')
    and regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''),
                       'SELECT auth\.uid\(\)', '', 'gi') ~* 'auth\.uid\(\)'
$$, 'no policy calls auth.uid() without (select ...)');

select * from finish();
rollback;
