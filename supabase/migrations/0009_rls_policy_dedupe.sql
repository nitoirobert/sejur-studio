-- 0009_rls_policy_dedupe: one definition of "visible to anon" and of "own storage folder".
--
-- 0002 wrote "published unit of an active property" three times (units_public, unit_prices_public,
-- photos_public). A policy expression runs under the caller's own RLS, so unit_prices and photos now
-- just ask "can I see this unit / this property?" and the answer comes from units_public and
-- properties_public. The rule lives in properties_public (status = 'activa') and units_public
-- (is_published); public_busy_ranges (0008) mirrors it because a security definer function bypasses RLS.
-- anon keeps the same rows as before.
--
-- 0003 had four storage.objects policies with the same predicate (select, insert, update, delete);
-- they become one FOR ALL policy.

-- ---------------------------------------------------------------------------
-- anon: catalogue
-- ---------------------------------------------------------------------------
drop policy units_public on public.units;
create policy units_public on public.units
  for select to anon using (
    is_published
    and exists (select 1 from public.properties p where p.id = units.property_id)
  );

drop policy unit_prices_public on public.unit_prices;
create policy unit_prices_public on public.unit_prices
  for select to anon using (
    exists (select 1 from public.units u where u.id = unit_prices.unit_id)
  );

drop policy photos_public on public.photos;
create policy photos_public on public.photos
  for select to anon using (
    exists (select 1 from public.properties p where p.id = photos.property_id)
    and (
      photos.unit_id is null
      or exists (select 1 from public.units u where u.id = photos.unit_id)
    )
  );

-- ---------------------------------------------------------------------------
-- owners: own organization folder in bucket `photos`
-- ---------------------------------------------------------------------------
drop policy photos_owner_select on storage.objects;
drop policy photos_owner_insert on storage.objects;
drop policy photos_owner_update on storage.objects;
drop policy photos_owner_delete on storage.objects;

create policy photos_owner on storage.objects
  for all to authenticated
  using (bucket_id = 'photos' and public.is_own_storage_path(name))
  with check (bucket_id = 'photos' and public.is_own_storage_path(name));
