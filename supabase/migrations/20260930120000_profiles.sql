-- Profiles, role protection, and row level security.
-- Image files are not removed here. The application deletes them through the Storage API
-- after an authorized profile delete. This migration does not write to storage.objects.

create type public.user_role as enum ('member', 'admin', 'super_admin');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role public.user_role not null default 'member',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (char_length(full_name) <= 80),
  constraint profiles_avatar_url_owner check (
    avatar_url is null
    or avatar_url ~ ('^' || user_id::text || '/avatar\.(jpg|jpeg|png|webp)$')
  )
);

create index profiles_role_idx on public.profiles (role);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jwt_email text;
begin
  if current_user in ('authenticated', 'anon') then
    if auth.uid() is null then
      raise exception 'not_authenticated' using errcode = '42501';
    end if;

    if tg_op = 'INSERT' then
      new.user_id = auth.uid();
      new.role = 'member';
      jwt_email = nullif(auth.jwt() ->> 'email', '');
      new.email = coalesce(jwt_email, nullif(new.email, ''));
      if new.email is null then
        raise exception 'email_required' using errcode = '42501';
      end if;
      return new;
    end if;

    if tg_op = 'UPDATE' then
      if new.id is distinct from old.id
        or new.user_id is distinct from old.user_id
        or new.role is distinct from old.role
        or new.email is distinct from old.email
        or new.created_at is distinct from old.created_at
      then
        raise exception 'profile_column_locked' using errcode = '42501';
      end if;

      if new.avatar_url is distinct from old.avatar_url
        and old.user_id is distinct from auth.uid()
      then
        raise exception 'avatar_owner_only' using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_name text;
begin
  requested_name = coalesce(new.raw_user_meta_data ->> 'full_name', '');
  if char_length(requested_name) > 80 then
    requested_name = left(requested_name, 80);
  end if;

  insert into public.profiles (user_id, full_name, email, role)
  values (new.id, requested_name, coalesce(new.email, ''), 'member');

  return new;
end;
$$;

create trigger profiles_protect_columns
before insert or update on public.profiles
for each row
execute function public.protect_profile_columns();

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where user_id = auth.uid()
$$;

create or replace function public.can_view_profile_image(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles owner
    join public.profiles requester
      on requester.user_id = auth.uid()
    where owner.user_id = target_user_id
      and (
        owner.user_id = auth.uid()
        or (requester.role = 'member' and owner.role = 'member')
        or (requester.role = 'admin' and owner.role in ('member', 'admin'))
        or requester.role = 'super_admin'
      )
  );
$$;

revoke all on function public.set_updated_at() from public;
revoke all on function public.protect_profile_columns() from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.current_user_role() from public;
revoke all on function public.can_view_profile_image(uuid) from public;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.can_view_profile_image(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_user() to supabase_auth_admin;
  end if;
end;
$$;

alter table public.profiles enable row level security;

create policy profiles_select_visible
on public.profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or (
    public.current_user_role() = 'member'
    and role = 'member'
  )
  or (
    public.current_user_role() = 'admin'
    and role in ('member', 'admin')
  )
  or public.current_user_role() = 'super_admin'
);

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'member'
);

create policy profiles_update_authorized
on public.profiles
for update
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_role() = 'super_admin'
)
with check (
  user_id = auth.uid()
  or public.current_user_role() = 'super_admin'
);

create policy profiles_delete_authorized
on public.profiles
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_role() = 'super_admin'
);

revoke all on table public.profiles from anon, authenticated;

grant select (
  id,
  user_id,
  full_name,
  role,
  avatar_url,
  created_at,
  updated_at
) on table public.profiles to authenticated;

grant insert (user_id, full_name) on table public.profiles to authenticated;
grant update (full_name, avatar_url) on table public.profiles to authenticated;
grant delete on table public.profiles to authenticated;
grant usage on schema public to authenticated;
grant usage on type public.user_role to authenticated;

-- Accounts created before this table existed do not fire the signup trigger.
insert into public.profiles (user_id, full_name, email, role)
select
  users.id,
  left(coalesce(users.raw_user_meta_data ->> 'full_name', ''), 80),
  coalesce(users.email, ''),
  'member'::public.user_role
from auth.users as users
where coalesce(users.email, '') <> ''
  and not exists (
    select 1
    from public.profiles as existing
    where existing.user_id = users.id
  );
