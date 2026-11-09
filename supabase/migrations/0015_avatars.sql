-- 0015_avatars: public bucket `avatars` for profile pictures, one file per user at <user_id>/avatar.webp.
-- Public read (the picture is shown in the site header); only the owner can write or delete it.
-- Size (2 MB) and MIME limits are enforced by the Storage API from the bucket row. The browser resizes to 256 px first.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_own_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy avatars_own_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy avatars_own_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);
