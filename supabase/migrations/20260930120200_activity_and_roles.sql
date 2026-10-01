-- Run once, after the profiles script. Do not run the first script again.
-- Adds an activity log and a super-admin-only role change.
-- Does not change user_id. A super admin cannot change their own role.

create table public.profile_activity (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  action text not null,
  target_user_id uuid not null,
  target_role public.user_role not null,
  created_at timestamptz not null default now(),
  constraint profile_activity_action_check check (
    action in (
      'profile_created',
      'profile_updated',
      'profile_deleted',
      'image_uploaded',
      'image_replaced',
      'image_deleted',
      'role_changed'
    )
  )
);

create index profile_activity_created_at_idx
  on public.profile_activity (created_at desc);

create index profile_activity_target_role_idx
  on public.profile_activity (target_role);

create or replace function public.log_profile_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  role_now public.user_role;
begin
  if tg_op = 'DELETE' then
    actor := coalesce(auth.uid(), old.user_id);
    insert into public.profile_activity (actor_user_id, action, target_user_id, target_role)
    values (actor, 'profile_deleted', old.user_id, old.role);
    return old;
  end if;

  actor := coalesce(auth.uid(), new.user_id);
  role_now := new.role;

  if tg_op = 'INSERT' then
    insert into public.profile_activity (actor_user_id, action, target_user_id, target_role)
    values (actor, 'profile_created', new.user_id, role_now);
    return new;
  end if;

  if new.avatar_url is distinct from old.avatar_url then
    insert into public.profile_activity (actor_user_id, action, target_user_id, target_role)
    values (
      actor,
      case
        when old.avatar_url is null then 'image_uploaded'
        when new.avatar_url is null then 'image_deleted'
        else 'image_replaced'
      end,
      new.user_id,
      role_now
    );
  end if;

  if new.role is distinct from old.role then
    insert into public.profile_activity (actor_user_id, action, target_user_id, target_role)
    values (actor, 'role_changed', new.user_id, role_now);
  end if;

  if new.full_name is distinct from old.full_name then
    insert into public.profile_activity (actor_user_id, action, target_user_id, target_role)
    values (actor, 'profile_updated', new.user_id, role_now);
  end if;

  return new;
end;
$$;

create trigger profiles_log_activity
after insert or update or delete on public.profiles
for each row
execute function public.log_profile_activity();

revoke all on function public.log_profile_activity() from public;
grant execute on function public.log_profile_activity() to authenticated;

create or replace function public.set_profile_role(
  target_user_id uuid,
  new_role public.user_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if public.current_user_role() is distinct from 'super_admin' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if target_user_id is not distinct from auth.uid() then
    raise exception 'cannot_change_own_role' using errcode = '42501';
  end if;

  update public.profiles
  set role = new_role
  where user_id = target_user_id;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_profile_role(uuid, public.user_role) from public;
grant execute on function public.set_profile_role(uuid, public.user_role) to authenticated;

alter table public.profile_activity enable row level security;

create policy profile_activity_select_authorized
on public.profile_activity
for select
to authenticated
using (
  public.current_user_role() = 'super_admin'
  or (
    public.current_user_role() = 'admin'
    and target_role in ('member', 'admin')
  )
);

revoke all on table public.profile_activity from anon, authenticated;

grant select (
  id,
  actor_user_id,
  action,
  target_user_id,
  target_role,
  created_at
) on table public.profile_activity to authenticated;

notify pgrst, 'reload schema';
