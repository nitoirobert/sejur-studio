-- Check 4: Storage bucket `photos` (private, 10 MB, webp only since 0011, paths <organization_id>/...).
-- Size and MIME limits are enforced by the Storage API from the bucket row, so they are
-- asserted on storage.buckets; path isolation is asserted through RLS on storage.objects.
begin;
\ir _lib/helpers.psql
select * from no_plan();

select is((select public from storage.buckets where id = 'photos'), false, 'bucket photos exists and is private');
select is((select file_size_limit from storage.buckets where id = 'photos'), 10485760::bigint,
  'bucket photos file_size_limit = 10 MB');
select is((select array(select m from storage.buckets, unnest(allowed_mime_types) m where id = 'photos' order by 1)),
  array['image/webp'],
  'bucket photos allows only image/webp (0011)');

-- Fixtures (as postgres): one object per org, plus one under a hidden property.
update public.properties set status = 'activa' where id in (tests.id('prop1'), tests.id('prop2'));
insert into storage.objects (bucket_id, name, owner, metadata) values
  ('photos', tests.id('org1') || '/' || tests.id('prop1') || '/a.webp', tests.id('user1'), '{"size":1000,"mimetype":"image/webp"}'),
  ('photos', tests.id('org2') || '/' || tests.id('prop2') || '/b.webp', tests.id('user2'), '{"size":1000,"mimetype":"image/webp"}');
insert into public.photos (organization_id, property_id, storage_path, position, is_cover) values
  (tests.id('org1'), tests.id('prop1'), tests.id('org1') || '/' || tests.id('prop1') || '/a.webp', 90, false),
  (tests.id('org2'), tests.id('prop2'), tests.id('org2') || '/' || tests.id('prop2') || '/b.webp', 90, false);

-- org1 owner
select tests.login(tests.id('user1'));
select ok(tests.cnt(format($$select 1 from storage.objects where bucket_id = 'photos' and name like %L$$,
  tests.id('org2') || '/%')) <= 0, 'org1 cannot read objects under <org2_id>/');
select is(tests.cnt(format($$select 1 from storage.objects where bucket_id = 'photos' and name like %L$$,
  tests.id('org1') || '/%')), 1::bigint, 'org1 reads own objects');
select is(tests.err(format($$insert into storage.objects (bucket_id, name, owner, metadata)
  values ('photos', %L, %L, '{"size":1000,"mimetype":"image/webp"}')$$,
  tests.id('org2') || '/x.webp', tests.id('user1'))), '42501', 'org1 cannot write under <org2_id>/');
select is(tests.err(format($$insert into storage.objects (bucket_id, name, owner, metadata)
  values ('photos', %L, %L, '{"size":1000,"mimetype":"image/webp"}')$$,
  tests.id('org1') || '/' || tests.id('prop1') || '/' || gen_random_uuid() || '.webp', tests.id('user1'))), null, 'org1 can write under own <org1_id>/');
select is(tests.err($$insert into storage.objects (bucket_id, name, owner) values ('photos', 'no-org/x.webp', auth.uid())$$),
  '42501', 'path without an own organization prefix refused');
select ok(tests.rows(format($$update storage.objects set metadata = metadata where name like %L$$,
  tests.id('org2') || '/%')) <= 0, 'org1 cannot update objects under <org2_id>/');
select ok(tests.rows(format($$delete from storage.objects where name like %L$$, tests.id('org2') || '/%')) <= 0,
  'org1 cannot delete objects under <org2_id>/');
reset role;
select is((select count(*) from storage.objects where name like tests.id('org2') || '/%'), 1::bigint,
  'org2 object still present after org1 delete attempt');

-- QA 1: an org1 photo row pointing into org2's folder is refused, so anon cannot
-- reach org2's object of a hidden property through org1's active property.
update public.properties set status = 'ascunsa' where id = tests.id('prop2');
delete from public.photos where storage_path = tests.id('org2') || '/' || tests.id('prop2') || '/b.webp';
select tests.login(tests.id('user1'));
select is(tests.err(format($$insert into public.photos (organization_id, property_id, storage_path, position, is_cover)
  values (%L, %L, %L, 91, false)$$, tests.id('org1'), tests.id('prop1'),
  tests.id('org2') || '/' || tests.id('prop2') || '/b.webp')), '23514',
  'owner1 photo row (own property) with an <org2_id>/<prop2_id>/ path refused (photos_storage_path_owner)');
select is(tests.err(format($$insert into public.photos (organization_id, property_id, storage_path, position, is_cover)
  values (%L, %L, %L, 91, false)$$, tests.id('org1'), tests.id('prop1'),
  tests.id('org1') || '/' || tests.id('prop2') || '/b.webp')), '23514',
  'owner1 photo row whose path names another property refused');
select is(tests.err(format($$update public.photos set storage_path = %L where storage_path = %L$$,
  tests.id('org2') || '/' || tests.id('prop2') || '/b.webp',
  tests.id('org1') || '/' || tests.id('prop1') || '/a.webp')), '23514',
  'owner1 cannot repoint an own photo row to org2''s object');
reset role;
select tests.login_anon();
select ok(tests.cnt(format($$select 1 from storage.objects where bucket_id = 'photos' and name = %L$$,
  tests.id('org2') || '/' || tests.id('prop2') || '/b.webp')) <= 0,
  'anon cannot read org2''s object after the refused org1 rows');
reset role;
insert into public.photos (organization_id, property_id, storage_path, position, is_cover) values
  (tests.id('org2'), tests.id('prop2'), tests.id('org2') || '/' || tests.id('prop2') || '/b.webp', 90, false);
update public.properties set status = 'activa' where id = tests.id('prop2');

-- anon: only photos of active properties
select tests.login_anon();
select is(tests.cnt(format($$select 1 from storage.objects where bucket_id = 'photos' and name = %L$$,
  tests.id('org2') || '/' || tests.id('prop2') || '/b.webp')), 1::bigint, 'anon reads photo of an active property');
select is(tests.err($$insert into storage.objects (bucket_id, name) values ('photos', 'x/y.webp')$$), '42501',
  'anon cannot upload');
reset role;
update public.properties set status = 'ascunsa' where id = tests.id('prop2');
select tests.login_anon();
select ok(tests.cnt(format($$select 1 from storage.objects where bucket_id = 'photos' and name = %L$$,
  tests.id('org2') || '/' || tests.id('prop2') || '/b.webp')) <= 0, 'anon cannot read photo of a hidden property');
reset role;

select * from finish();
rollback;
