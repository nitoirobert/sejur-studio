-- Check 8: reorder_photos -> positions 0..n-1, at most one cover per property, other org refused.
begin;
\ir _lib/helpers.psql
select * from no_plan();

-- fixtures: 3 photos on prop1 (as postgres), cleared of seed photos for a clean order
delete from public.photos where property_id = tests.id('prop1');
insert into public.photos (id, organization_id, property_id, storage_path, position, is_cover) values
  ('00000000-0000-4000-b000-000000000001', tests.id('org1'), tests.id('prop1'), tests.id('org1') || '/' || tests.id('prop1') || '/1.webp', 5, true),
  ('00000000-0000-4000-b000-000000000002', tests.id('org1'), tests.id('prop1'), tests.id('org1') || '/' || tests.id('prop1') || '/2.webp', 7, false),
  ('00000000-0000-4000-b000-000000000003', tests.id('org1'), tests.id('prop1'), tests.id('org1') || '/' || tests.id('prop1') || '/3.webp', 9, false);

select tests.login(tests.id('user1'));
select is(tests.err(format($$select public.reorder_photos(p_property_id => %L::uuid, p_photo_ids => array[
  '00000000-0000-4000-b000-000000000003', '00000000-0000-4000-b000-000000000001',
  '00000000-0000-4000-b000-000000000002']::uuid[])$$, tests.id('prop1'))), null, 'reorder_photos runs for own property');
select results_eq(
  format($$select id::text from public.photos where property_id = %L order by position$$, tests.id('prop1')),
  $$values ('00000000-0000-4000-b000-000000000003'), ('00000000-0000-4000-b000-000000000001'),
           ('00000000-0000-4000-b000-000000000002')$$,
  'photos follow the requested order');
select results_eq(
  format($$select position from public.photos where property_id = %L order by position$$, tests.id('prop1')),
  $$values (0), (1), (2)$$, 'positions are exactly 0..n-1');
reset role;

-- at most one cover per property
select is(tests.err($$update public.photos set is_cover = true where id = '00000000-0000-4000-b000-000000000002'$$),
  '23505', 'second cover on the same property refused (unique)');
select is((select count(*) from public.photos where property_id = tests.id('prop1') and is_cover), 1::bigint,
  'exactly one cover remains');

-- other org refused, positions of org2 untouched
insert into public.photos (id, organization_id, property_id, storage_path, position, is_cover) values
  ('00000000-0000-4000-b000-000000000009', tests.id('org2'), tests.id('prop2'), tests.id('org2') || '/' || tests.id('prop2') || '/9.webp', 4, false);
select tests.login(tests.id('user1'));
select isnt(tests.err(format($$select public.reorder_photos(p_property_id => %L::uuid,
  p_photo_ids => array['00000000-0000-4000-b000-000000000009']::uuid[])$$, tests.id('prop2'))), null,
  'reorder on an org2 property refused');
select isnt(tests.err(format($$select public.reorder_photos(p_property_id => %L::uuid,
  p_photo_ids => array['00000000-0000-4000-b000-000000000009', '00000000-0000-4000-b000-000000000001']::uuid[])$$,
  tests.id('prop1'))), null, 'org2 photo id smuggled into an own property refused');
reset role;
select is((select position from public.photos where id = '00000000-0000-4000-b000-000000000009'), 4,
  'org2 photo position unchanged');

select * from finish();
rollback;
