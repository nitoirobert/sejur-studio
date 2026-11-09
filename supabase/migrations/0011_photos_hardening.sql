-- 0011_photos_hardening: QA findings on 0010 (brief 04, #db-fix2).
--
--  * Storage write policy: 0010 accepted any <org>/<property>/[a-z0-9-]{1,64}.webp, so a client could
--    upload `poza-mea.webp` straight to Storage. Writes now accept only
--    <org uuid>/<property uuid of that org>/<uuid>.webp, every segment a lowercase canonical uuid
--    (the name the server action picks with randomUUID()). Read and delete stay organization-wide
--    (USING unchanged), so any older file can still be removed.
--  * Bucket `photos` accepts only image/webp (the panel converts every upload to WebP). The 10 MB
--    size limit stays. The Storage API enforces both from the bucket row.
--  * unit_prices: at most one weekend rule per unit, like the base price (0001
--    unit_prices_one_base_idx). Season rules stay many per unit.
--
-- Checked on dev before writing: no unit has two weekend rows, and every existing object in
-- `photos` already matches the new path pattern.

-- ---------------------------------------------------------------------------
-- Storage: strict upload path
-- ---------------------------------------------------------------------------
drop policy photos_owner on storage.objects;
create policy photos_owner on storage.objects
  for all to authenticated
  using (bucket_id = 'photos' and public.is_own_storage_path(objects.name))
  with check (
    bucket_id = 'photos'
    and public.is_own_storage_path(objects.name)
    and objects.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
    and exists (select 1 from public.properties p
                 where p.organization_id::text = split_part(objects.name, '/', 1)
                   and p.id::text = split_part(objects.name, '/', 2))
  );

-- ---------------------------------------------------------------------------
-- Bucket: WebP only, size limit unchanged
-- ---------------------------------------------------------------------------
update storage.buckets
   set allowed_mime_types = array['image/webp']
 where id = 'photos';

-- ---------------------------------------------------------------------------
-- unit_prices: one weekend rule per unit
-- ---------------------------------------------------------------------------
create unique index unit_prices_one_weekend_idx on public.unit_prices (unit_id) where kind = 'weekend';
