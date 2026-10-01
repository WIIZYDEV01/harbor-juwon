begin;

select plan(17);

create or replace function pg_temp.create_test_user(p_email text, p_name text)
returns uuid
language plpgsql
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    new_id,
    'authenticated',
    'authenticated',
    p_email,
    'test-only-not-a-password',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  return new_id;
end;
$$;

create procedure pg_temp.assume_user(p_setting text, p_email text)
language plpgsql
as $$
declare
  uid text := current_setting(p_setting);
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'email', p_email)::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;

create procedure pg_temp.assume_none()
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  execute 'reset role';
end;
$$;

select has_table('public', 'profile_activity', 'profile_activity table exists');

select is(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'profile_activity'
  ),
  true,
  'RLS is enabled on profile_activity'
);

select policies_are(
  'public',
  'profile_activity',
  array['profile_activity_select_authorized'],
  'profile_activity has a single SELECT policy'
);

do $$
declare
  member_a uuid;
  member_b uuid;
  member_target uuid;
  admin_a uuid;
  super_a uuid;
begin
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);

  member_a := pg_temp.create_test_user('activity.member.a@example.com', 'Activity Member A');
  member_b := pg_temp.create_test_user('activity.member.b@example.com', 'Activity Member B');
  member_target := pg_temp.create_test_user('activity.target@example.com', 'Activity Target');
  admin_a := pg_temp.create_test_user('activity.admin.a@example.com', 'Activity Admin A');
  super_a := pg_temp.create_test_user('activity.super.a@example.com', 'Activity Super A');

  update public.profiles set role = 'admin' where user_id = admin_a;
  update public.profiles set role = 'super_admin' where user_id = super_a;
  update public.profiles set full_name = 'Activity Member B Renamed' where user_id = member_b;
  update public.profiles set full_name = 'Activity Super A Renamed' where user_id = super_a;

  perform set_config('test.member_a', member_a::text, true);
  perform set_config('test.member_b', member_b::text, true);
  perform set_config('test.member_target', member_target::text, true);
  perform set_config('test.admin_a', admin_a::text, true);
  perform set_config('test.super_a', super_a::text, true);
end;
$$;

call pg_temp.assume_user('test.member_a', 'activity.member.a@example.com');
set local role authenticated;

select is_empty(
  $$select id from public.profile_activity$$,
  'member cannot read activity'
);

select throws_ok(
  $$select public.set_profile_role(current_setting('test.member_b')::uuid, 'admin')$$,
  '42501',
  'not_authorized',
  'member cannot change a role'
);

select throws_ok(
  $$insert into public.profile_activity (actor_user_id, action, target_user_id, target_role)
    values (auth.uid(), 'profile_updated', auth.uid(), 'member')$$,
  '42501',
  null,
  'member cannot write activity directly'
);

call pg_temp.assume_none();
call pg_temp.assume_user('test.admin_a', 'activity.admin.a@example.com');
set local role authenticated;

select isnt_empty(
  $$select id from public.profile_activity where target_role = 'member'$$,
  'admin reads member activity'
);

select is_empty(
  $$select id from public.profile_activity where target_role = 'super_admin'$$,
  'admin cannot read super-admin activity'
);

select throws_ok(
  $$select public.set_profile_role(current_setting('test.member_b')::uuid, 'admin')$$,
  '42501',
  'not_authorized',
  'admin cannot change a role'
);

call pg_temp.assume_none();
call pg_temp.assume_user('test.super_a', 'activity.super.a@example.com');
set local role authenticated;

select isnt_empty(
  $$select id from public.profile_activity where target_role = 'super_admin'$$,
  'super admin reads super-admin activity'
);

select lives_ok(
  $$select public.set_profile_role(current_setting('test.member_target')::uuid, 'admin')$$,
  'super admin changes another user role through the dedicated function'
);

select is(
  (select role::text from public.profiles where user_id = current_setting('test.member_target')::uuid),
  'admin',
  'role change is stored'
);

select throws_ok(
  $$select public.set_profile_role(auth.uid(), 'member')$$,
  '42501',
  'cannot_change_own_role',
  'super admin cannot change own role'
);

select throws_ok(
  $$update public.profiles set role = 'member'
    where user_id = current_setting('test.member_target')::uuid$$,
  '42501',
  null,
  'ordinary profile update cannot change role, even for a super admin'
);

select throws_ok(
  $$update public.profiles set user_id = gen_random_uuid()
    where user_id = current_setting('test.member_target')::uuid$$,
  '42501',
  null,
  'ordinary profile update cannot change user_id, even for a super admin'
);

select isnt_empty(
  $$select id from public.profile_activity
    where action = 'role_changed'
      and target_user_id = current_setting('test.member_target')::uuid
      and actor_user_id = auth.uid()$$,
  'role change is written to activity with the super admin as actor'
);

call pg_temp.assume_none();
set local role anon;

select throws_ok(
  $$select id from public.profile_activity$$,
  '42501',
  null,
  'anonymous user cannot read activity'
);

reset role;

select * from finish();

rollback;
