begin;

select plan(20);

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

select is(
  (select buckets.public from storage.buckets where buckets.id = 'profile-images'),
  false,
  'profile-images bucket is private'
);

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'profile_images_%'
  ),
  4,
  'four profile image storage policies exist'
);

do $$
declare
  member_a uuid;
  member_b uuid;
  admin_a uuid;
  admin_b uuid;
  super_a uuid;
begin
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);

  member_a := pg_temp.create_test_user('member.a@example.com', 'Member A');
  member_b := pg_temp.create_test_user('member.b@example.com', 'Member B');
  admin_a := pg_temp.create_test_user('admin.a@example.com', 'Admin A');
  admin_b := pg_temp.create_test_user('admin.b@example.com', 'Admin B');
  super_a := pg_temp.create_test_user('super.a@example.com', 'Super A');

  update public.profiles set role = 'admin' where user_id = admin_a;
  update public.profiles set role = 'admin' where user_id = admin_b;
  update public.profiles set role = 'super_admin' where user_id = super_a;

  insert into storage.objects (bucket_id, name)
  values
    ('profile-images', member_a::text || '/avatar.webp'),
    ('profile-images', member_b::text || '/avatar.webp'),
    ('profile-images', admin_a::text || '/avatar.webp'),
    ('profile-images', admin_b::text || '/avatar.webp'),
    ('profile-images', super_a::text || '/avatar.webp');

  perform set_config('test.member_a', member_a::text, true);
  perform set_config('test.member_b', member_b::text, true);
  perform set_config('test.admin_a', admin_a::text, true);
  perform set_config('test.admin_b', admin_b::text, true);
  perform set_config('test.super_a', super_a::text, true);
  perform set_config('test.path_member_a', member_a::text || '/avatar.webp', true);
  perform set_config('test.path_member_b', member_b::text || '/avatar.webp', true);
  perform set_config('test.path_admin_a', admin_a::text || '/avatar.webp', true);
  perform set_config('test.path_admin_b', admin_b::text || '/avatar.webp', true);
  perform set_config('test.path_super_a', super_a::text || '/avatar.webp', true);
end;
$$;

call pg_temp.assume_user('test.member_a', 'member.a@example.com');
set local role authenticated;

select is(
  (select count(*)::int from storage.objects where name = current_setting('test.path_member_a')),
  1,
  'member can read own image'
);

select is(
  (select count(*)::int from storage.objects where name = current_setting('test.path_member_b')),
  1,
  'member can read another member image'
);

select is_empty(
  $$select id from storage.objects where name = current_setting('test.path_admin_a')$$,
  'member cannot read an admin image'
);

select is_empty(
  $$select id from storage.objects where name = current_setting('test.path_super_a')$$,
  'member cannot read a super-admin image'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('profile-images', auth.uid()::text || '/avatar.png')$$,
  'member can upload own image'
);

select lives_ok(
  $$update storage.objects
    set metadata = '{"replaced":true}'::jsonb
    where name = auth.uid()::text || '/avatar.png'$$,
  'member can replace own image'
);

select lives_ok(
  $$delete from storage.objects where name = auth.uid()::text || '/avatar.png'$$,
  'member can delete own image'
);

delete from storage.objects where name = current_setting('test.path_admin_a');

update storage.objects
set metadata = '{"hijack":true}'::jsonb
where name = current_setting('test.path_admin_b');

select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('profile-images', current_setting('test.admin_a') || '/avatar.jpg')$$,
  'member cannot upload into an admin folder'
);

call pg_temp.assume_none();
reset role;

select is(
  (select count(*)::int from storage.objects where name = current_setting('test.path_admin_a')),
  1,
  'member cannot delete an admin image'
);

select is(
  (
    select coalesce(metadata ->> 'hijack', '')
    from storage.objects
    where name = current_setting('test.path_admin_b')
  ),
  '',
  'member cannot update an admin image'
);

call pg_temp.assume_user('test.admin_a', 'admin.a@example.com');
set local role authenticated;

select is(
  (select count(*)::int from storage.objects where name = current_setting('test.path_member_a')),
  1,
  'admin can read a member image'
);

select is(
  (select count(*)::int from storage.objects where name = current_setting('test.path_admin_b')),
  1,
  'admin can read another admin image'
);

select is_empty(
  $$select id from storage.objects where name = current_setting('test.path_super_a')$$,
  'admin cannot read a super-admin image'
);

delete from storage.objects where name = current_setting('test.path_super_a');

call pg_temp.assume_none();
reset role;

select is(
  (select count(*)::int from storage.objects where name = current_setting('test.path_super_a')),
  1,
  'admin cannot delete a super-admin image'
);

call pg_temp.assume_user('test.super_a', 'super.a@example.com');
set local role authenticated;

select is(
  (
    select count(*)::int
    from storage.objects
    where name in (
      current_setting('test.path_member_a'),
      current_setting('test.path_admin_a'),
      current_setting('test.path_super_a')
    )
  ),
  3,
  'super admin can read member, admin, and super-admin images'
);

delete from storage.objects where name = current_setting('test.path_member_a');

call pg_temp.assume_none();
reset role;

select is(
  (select count(*)::int from storage.objects where name = current_setting('test.path_member_a')),
  1,
  'super admin cannot directly delete another user image'
);

set local role anon;

select throws_ok(
  $$select id from storage.objects where bucket_id = 'profile-images'$$,
  'anonymous user cannot read profile images'
);

select throws_ok(
  $$delete from storage.objects where bucket_id = 'profile-images'$$,
  'anonymous user cannot delete profile images'
);

select * from finish();

rollback;
