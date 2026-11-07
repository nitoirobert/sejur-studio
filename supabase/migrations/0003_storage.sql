-- 0003_storage: private bucket `photos`, paths <organization_id>/<property_id>/<file>.
-- Size (10 MB) and MIME (jpeg, png, webp, avif; no SVG) limits are enforced by the Storage API from the bucket row.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- True when the first path segment is an organization of the current user.
-- Text comparison, so a malformed path is simply refused (no cast error).
create function public.is_own_storage_path(path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.user_id = (select auth.uid())
      and m.organization_id::text = split_part(path, '/', 1)
  )
$$;

revoke execute on function public.is_own_storage_path(text) from public, anon;
grant execute on function public.is_own_storage_path(text) to authenticated;

-- Owners: full access to their own organization folder.
create policy photos_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and public.is_own_storage_path(name));

create policy photos_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and public.is_own_storage_path(name));

create policy photos_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and public.is_own_storage_path(name))
  with check (bucket_id = 'photos' and public.is_own_storage_path(name));

create policy photos_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and public.is_own_storage_path(name));

-- Anon: only files registered in public.photos and visible through its anon policy
-- (active property, published unit). Signed URLs / downloads go through this check.
create policy photos_public_select on storage.objects
  for select to anon
  using (
    bucket_id = 'photos'
    and exists (select 1 from public.photos ph where ph.storage_path = objects.name)
  );
