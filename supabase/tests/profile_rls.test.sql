begin;

select plan(45);

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

select has_table('public', 'profiles', 'profiles table exists');

select is(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'profiles'
  ),
  true,
  'RLS is enabled on profiles'
);

select policies_are(
  'public',
  'profiles',
  array[
    'profiles_select_visible',
    'profiles_insert_own',
    'profiles_update_authorized',
    'profiles_delete_authorized'
  ],
  'profiles has one policy per command'
);

do $$
declare
  member_a uuid;
  member_b uuid;
  member_delete uuid;
  member_target uuid;
  admin_a uuid;
  admin_b uuid;
  super_a uuid;
begin
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);

  member_a := pg_temp.create_test_user('member.a@example.com', 'Member A');
  member_b := pg_temp.create_test_user('member.b@example.com', 'Member B');
  member_delete := pg_temp.create_test_user('member.delete@example.com', 'Member Delete');
  member_target := pg_temp.create_test_user('member.target@example.com', 'Member Target');
  admin_a := pg_temp.create_test_user('admin.a@example.com', 'Admin A');
  admin_b := pg_temp.create_test_user('admin.b@example.com', 'Admin B');
  super_a := pg_temp.create_test_user('super.a@example.com', 'Super A');

  update public.profiles set role = 'admin' where user_id = admin_a;
  update public.profiles set role = 'admin' where user_id = admin_b;
  update public.profiles set role = 'super_admin' where user_id = super_a;

  perform set_config('test.member_a', member_a::text, true);
  perform set_config('test.member_b', member_b::text, true);
  perform set_config('test.member_delete', member_delete::text, true);
  perform set_config('test.member_target', member_target::text, true);
  perform set_config('test.admin_a', admin_a::text, true);
  perform set_config('test.admin_b', admin_b::text, true);
  perform set_config('test.super_a', super_a::text, true);
end;
$$;

call pg_temp.assume_user('test.member_a', 'member.a@example.com');
set local role authenticated;

select is(auth.uid()::text, current_setting('test.member_a'), 'member impersonation matches auth.uid()');

select is(
  (select full_name from public.profiles where user_id = auth.uid()),
  'Member A',
  'member reads own profile'
);

select is(
  (select full_name from public.profiles where user_id = current_setting('test.member_b')::uuid),
  'Member B',
  'member reads another member profile'
);

select is_empty(
  $$select id from public.profiles where user_id = current_setting('test.admin_a')::uuid$$,
  'member cannot read an admin profile'
);

select is_empty(
  $$select id from public.profiles where user_id = current_setting('test.super_a')::uuid$$,
  'member cannot read a super-admin profile'
);

select lives_ok(
  $$update public.profiles set full_name = 'Member A Updated' where user_id = auth.uid()$$,
  'member updates own profile'
);

select throws_ok(
  $$update public.profiles set role = 'admin' where user_id = auth.uid()$$,
  'member cannot change role to admin'
);

select throws_ok(
  $$update public.profiles set role = 'super_admin' where user_id = auth.uid()$$,
  'member cannot change role to super_admin'
);

select throws_ok(
  $$update public.profiles set user_id = gen_random_uuid() where user_id = auth.uid()$$,
  'member cannot change user_id'
);

update public.profiles
set full_name = 'Hacked member'
where user_id = current_setting('test.member_b')::uuid;

update public.profiles
set full_name = 'Hacked admin'
where user_id = current_setting('test.admin_a')::uuid;

delete from public.profiles where user_id = current_setting('test.admin_a')::uuid;
delete from public.profiles where user_id = current_setting('test.member_target')::uuid;

select throws_ok(
  $$insert into public.profiles (user_id, full_name)
    values ('00000000-0000-4000-8000-000000000099', 'Other user')$$,
  'member cannot insert a profile for another user'
);

select throws_ok(
  $$insert into public.profiles (user_id, full_name, role)
    values (auth.uid(), 'Escalated', 'admin')$$,
  'member cannot insert an admin profile'
);

call pg_temp.assume_none();
reset role;

select is(
  (select full_name from public.profiles where user_id = current_setting('test.member_a')::uuid),
  'Member A Updated',
  'member own update was stored'
);

select is(
  (select role::text from public.profiles where user_id = current_setting('test.member_a')::uuid),
  'member',
  'member role is unchanged'
);

select is(
  (select full_name from public.profiles where user_id = current_setting('test.member_b')::uuid),
  'Member B',
  'member cannot update another member profile'
);

select is(
  (select full_name from public.profiles where user_id = current_setting('test.admin_a')::uuid),
  'Admin A',
  'member cannot update an admin profile'
);

select is(
  (select count(*)::int from public.profiles where user_id = current_setting('test.admin_a')::uuid),
  1,
  'member cannot delete an admin profile'
);

select is(
  (select count(*)::int from public.profiles where user_id = current_setting('test.member_target')::uuid),
  1,
  'member cannot delete another member profile'
);

call pg_temp.assume_user('test.member_delete', 'member.delete@example.com');
set local role authenticated;

select lives_ok(
  $$delete from public.profiles where user_id = auth.uid()$$,
  'member deletes own profile'
);

select lives_ok(
  $$insert into public.profiles (user_id, full_name) values (auth.uid(), 'Member Rebuilt')$$,
  'member creates own profile after deletion'
);

call pg_temp.assume_none();
reset role;

select is(
  (select role::text from public.profiles where user_id = current_setting('test.member_delete')::uuid),
  'member',
  'recreated profile is forced to member'
);

call pg_temp.assume_user('test.admin_a', 'admin.a@example.com');
set local role authenticated;

select is(
  (select full_name from public.profiles where user_id = current_setting('test.member_b')::uuid),
  'Member B',
  'admin reads a member profile'
);

select is(
  (select full_name from public.profiles where user_id = current_setting('test.admin_b')::uuid),
  'Admin B',
  'admin reads another admin profile'
);

select is_empty(
  $$select id from public.profiles where user_id = current_setting('test.super_a')::uuid$$,
  'admin cannot read a super-admin profile'
);

select throws_ok(
  $$update public.profiles set role = 'super_admin' where user_id = auth.uid()$$,
  'admin cannot change role to super_admin'
);

select throws_ok(
  $$update public.profiles set user_id = gen_random_uuid() where user_id = auth.uid()$$,
  'admin cannot change user_id'
);

update public.profiles
set full_name = 'Admin rewrote member'
where user_id = current_setting('test.member_target')::uuid;

delete from public.profiles where user_id = current_setting('test.member_target')::uuid;

call pg_temp.assume_none();
reset role;

select is(
  (select full_name from public.profiles where user_id = current_setting('test.member_target')::uuid),
  'Member Target',
  'admin cannot update another profile'
);

select is(
  (select count(*)::int from public.profiles where user_id = current_setting('test.member_target')::uuid),
  1,
  'admin cannot delete another profile'
);

call pg_temp.assume_user('test.super_a', 'super.a@example.com');
set local role authenticated;

select is(
  (
    select count(*)::int
    from public.profiles
    where user_id in (
      current_setting('test.member_a')::uuid,
      current_setting('test.member_b')::uuid,
      current_setting('test.member_target')::uuid
    )
  ),
  3,
  'super admin reads member profiles'
);

select is(
  (select full_name from public.profiles where user_id = current_setting('test.admin_b')::uuid),
  'Admin B',
  'super admin reads an admin profile'
);

select is(
  (select role::text from public.profiles where user_id = auth.uid()),
  'super_admin',
  'super admin reads own super-admin profile'
);

select lives_ok(
  $$update public.profiles set full_name = 'Renamed by super' where user_id = current_setting('test.member_b')::uuid$$,
  'super admin updates another profile full_name'
);

select throws_ok(
  $$update public.profiles set role = 'admin' where user_id = current_setting('test.member_b')::uuid$$,
  'super admin cannot change another user role'
);

select throws_ok(
  $$update public.profiles set user_id = gen_random_uuid() where user_id = auth.uid()$$,
  'super admin cannot change user_id'
);

select throws_ok(
  $$update public.profiles set avatar_url = current_setting('test.member_b') || '/avatar.webp' where user_id = current_setting('test.member_b')::uuid$$,
  'super admin cannot change another user avatar_url'
);

select lives_ok(
  $$delete from public.profiles where user_id = current_setting('test.member_target')::uuid$$,
  'super admin deletes another profile'
);

call pg_temp.assume_none();
reset role;

select is(
  (select full_name from public.profiles where user_id = current_setting('test.member_b')::uuid),
  'Renamed by super',
  'super admin full_name update was stored'
);

select is(
  (select count(*)::int from public.profiles where user_id = current_setting('test.member_target')::uuid),
  0,
  'super admin profile delete removed the row'
);

select is(
  (select role::text from public.profiles where user_id = current_setting('test.member_a')::uuid),
  'member',
  'role escalation did not stick'
);

set local role anon;

select throws_ok(
  $$select id from public.profiles$$,
  'anonymous user cannot read profiles'
);

select throws_ok(
  $$insert into public.profiles (user_id, full_name) values (gen_random_uuid(), 'Anon')$$,
  'anonymous user cannot create a profile'
);

select throws_ok(
  $$update public.profiles set full_name = 'Anon'$$,
  'anonymous user cannot update profiles'
);

select throws_ok(
  $$delete from public.profiles$$,
  'anonymous user cannot delete profiles'
);

select * from finish();

rollback;
