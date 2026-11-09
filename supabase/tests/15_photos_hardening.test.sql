-- 0011_photos_hardening: strict Storage upload names, WebP-only bucket, one weekend price per unit.
begin;
\ir _lib/helpers.psql
select * from no_plan();

-- ===========================================================================
-- Bucket: WebP only, 10 MB kept
-- ===========================================================================
select is((select allowed_mime_types from storage.buckets where id = 'photos'), array['image/webp'],
  'bucket photos allows only image/webp');
select is((select file_size_limit from storage.buckets where id = 'photos'), 10485760::bigint,
  'bucket photos keeps the 10 MB size limit');
select is((select public from storage.buckets where id = 'photos'), false, 'bucket photos stays private');

-- ===========================================================================
-- Storage: only <org uuid>/<property uuid of that org>/<uuid>.webp
-- ===========================================================================
create or replace function tests.put15(path text) returns text
language plpgsql as $$
begin
  insert into storage.objects (bucket_id, name, owner, metadata)
  values ('photos', path, auth.uid(), '{"size":1000,"mimetype":"image/webp"}');
  return null;
exception when others then
  return sqlstate;
end $$;
grant execute on function tests.put15(text) to authenticated, anon;

create table tests.p15 as
select tests.id('org1') || '/' || tests.id('prop1') || '/' as own,
       tests.id('org1') || '/' || tests.id('prop2') || '/' as other_prop;
grant select on tests.p15 to authenticated;

select tests.login(tests.id('user1'));
select is(tests.put15((select own from tests.p15) || gen_random_uuid() || '.webp'), null,
  '<org1>/<prop1>/<uuid>.webp accepted');
select is(tests.put15((select own from tests.p15) || 'poza-mea.webp'), '42501',
  '<org1>/<prop1>/poza-mea.webp refused');
select is(tests.put15((select own from tests.p15) || gen_random_uuid() || '.jpg'), '42501',
  '<org1>/<prop1>/<uuid>.jpg refused');
select is(tests.put15((select own from tests.p15) || 'poza.jpg'), '42501',
  '<org1>/<prop1>/poza.jpg refused');
select is(tests.put15((select own from tests.p15) || upper(gen_random_uuid()::text) || '.webp'), '42501',
  'upper-case uuid file name refused');
select is(tests.put15((select own from tests.p15) || replace(gen_random_uuid()::text, '-', '') || '.webp'), '42501',
  'uuid without dashes refused');
select is(tests.put15((select own from tests.p15) || gen_random_uuid() || '.WEBP'), '42501',
  'upper-case extension refused');
select is(tests.put15((select own from tests.p15) || gen_random_uuid() || '.webp.webp'), '42501',
  'double extension refused');
select is(tests.put15((select own from tests.p15) || gen_random_uuid() || '/' || gen_random_uuid() || '.webp'), '42501',
  'extra path segment refused');
select is(tests.put15((select other_prop from tests.p15) || gen_random_uuid() || '.webp'), '42501',
  'uuid name under another org''s property refused');
select is(tests.put15(upper((select own from tests.p15)) || gen_random_uuid() || '.webp'), '42501',
  'upper-case org/property segments refused');
reset role;

-- ===========================================================================
-- unit_prices: one weekend rule per unit
-- ===========================================================================
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'unit_prices'
                    and indexname = 'unit_prices_one_weekend_idx'
                    and indexdef like 'CREATE UNIQUE INDEX%(unit_id) WHERE (kind = ''weekend''::price_kind)'),
  'unique index unit_prices_one_weekend_idx (unit_id) where kind = weekend');

insert into public.unit_prices (organization_id, unit_id, kind, price_per_night)
values (tests.id('org2'), tests.id('unit2'), 'weekend', 30000)
on conflict (unit_id) where kind = 'weekend' do nothing;
select is((select count(*) from public.unit_prices where unit_id = tests.id('unit2') and kind = 'weekend'), 1::bigint,
  'unit2 has one weekend rule');
select is(tests.err(format($$insert into public.unit_prices (organization_id, unit_id, kind, price_per_night)
  values (%L, %L, 'weekend', 31000)$$, tests.id('org2'), tests.id('unit2'))), '23505',
  'a second weekend rule on the same unit raises 23505');

select tests.login(tests.id('user2'));
select is(tests.err(format($$insert into public.unit_prices (organization_id, unit_id, kind, price_per_night)
  values (%L, %L, 'weekend', 32000)$$, tests.id('org2'), tests.id('unit2'))), '23505',
  'owner: a second weekend rule raises 23505 too');
reset role;

-- controls: a weekend rule on another unit and several season rules on one unit are still allowed
select is(tests.err(format($$insert into public.unit_prices (organization_id, unit_id, kind, price_per_night)
  values (%L, %L, 'weekend', 40000)
  on conflict (unit_id) where kind = 'weekend' do update set price_per_night = excluded.price_per_night$$,
  tests.id('org1'), tests.id('unit1'))), null, 'weekend rule on another unit allowed (upsert)');
select is(tests.err(format($$insert into public.unit_prices (organization_id, unit_id, kind, price_per_night, date_from, date_to)
  values (%L, %L, 'season', 50000, '2032-07-01', '2032-08-01'), (%L, %L, 'season', 55000, '2032-07-15', '2032-07-20')$$,
  tests.id('org2'), tests.id('unit2'), tests.id('org2'), tests.id('unit2'))), null,
  'two season rules on the same unit still allowed');

select * from finish();
rollback;
