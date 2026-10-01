-- Private profile-images bucket and storage.objects policies.
-- Policies may be created on storage.objects. This file does not insert, update,
-- or delete object rows. The application removes files through the Storage API.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
);

create or replace function public.profile_image_owner_id(object_name text)
returns uuid
language plpgsql
stable
set search_path = public, storage
as $$
declare
  folder text;
begin
  if object_name is null
    or object_name !~ '^[0-9a-f-]{36}/avatar\.(jpg|jpeg|png|webp)$'
  then
    return null;
  end if;

  folder = (storage.foldername(object_name))[1];
  if folder is null
    or folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return null;
  end if;

  return folder::uuid;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.profile_image_owner_id(text) from public;
grant execute on function public.profile_image_owner_id(text) to authenticated;

revoke all on table storage.objects from anon;
revoke all on table storage.buckets from anon;

create policy profile_images_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-images'
  and public.can_view_profile_image(public.profile_image_owner_id(name))
);

create policy profile_images_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and name ~ '^[0-9a-f-]{36}/avatar\.(jpg|jpeg|png|webp)$'
);

create policy profile_images_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and name ~ '^[0-9a-f-]{36}/avatar\.(jpg|jpeg|png|webp)$'
);

create policy profile_images_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

notify pgrst, 'reload schema';
