# Harbor

Staff directory. Sign in is required. Permissions are enforced in Postgres and Storage.

Permissions are enforced in Postgres and Storage. The interface only reflects them.

## Local setup

1. Install Docker and the Supabase CLI.
2. Copy `.env.example` to `.env.local` and fill in the project URL and the publishable (anon) key.
3. Put `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` only. The browser never receives it.
4. Start the local stack and apply migrations:

```bash
npm install
npx supabase start
npx supabase db reset
```

`supabase start` prints the API URL and keys. Use those in `.env.local`.

5. Run the app:

```bash
npm run dev
```

6. Database tests:

```bash
npx supabase test db
```

## Environment variables

| Name | Where it is used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server. This is the publishable/anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Seed script, and server-only Storage cleanup after a profile row is deleted |
| `SEED_*_EMAIL` / `SEED_*_PASSWORD` | Local test accounts only |

Do not commit `.env.local`.

## Migrations

SQL lives in `supabase/migrations`.

- `profiles` with role enum `member`, `admin`, `super_admin`
- RLS policies for select, insert, update, and delete
- Private `profile-images` bucket (2 MB, JPEG/PNG/WEBP)
- Storage policies for select, insert, update, and delete
- `profile_activity`, written by a trigger on `profiles`. Admins read member and admin events. Super admins read all events. Members read none.
- `set_profile_role(target_user_id, new_role)`, the only way to change a role from the app. Super admin only, never on their own account.

The migrations do not delete Storage objects. After Row Level Security deletes a profile, the server calls the Storage API to remove that user's files.

## Roles

| Role | Profiles | Images |
| --- | --- | --- |
| Member | Full CRUD on their own profile. Can read other members' name, role, and image. | Own image upload, replace, and delete. Cannot read admin or super admin images. |
| Admin | Full CRUD on their own profile. Can read members and admins. | Can read member and admin images. Cannot read or change super admin data. |
| Super admin | Can read everyone, edit any full name, delete profiles, and change another person's role on that person's profile page. The name form cannot change `role` or `user_id`. | Can read every image. Direct image upload, replace, and delete stay on their own file. |

A new account is always a member. Signup metadata cannot set a role.

## Test accounts

Do not put real passwords in the repository. In `.env.local`:

```
SEED_MEMBER_EMAIL=member.test@example.com
SEED_MEMBER_PASSWORD=choose-a-local-password
SEED_ADMIN_EMAIL=admin.test@example.com
SEED_ADMIN_PASSWORD=choose-a-local-password
SEED_SUPER_ADMIN_EMAIL=super.test@example.com
SEED_SUPER_ADMIN_PASSWORD=choose-a-local-password
```

Then:

```bash
node --experimental-websocket scripts/seed-test-users.mjs
```

The script prints the email and role. It does not print passwords. On Node 20, `--experimental-websocket` is required by `supabase-js`; Node 22 and later can drop the flag.

Manual alternative: sign up in the app, then in the Supabase SQL editor run:

```sql
update public.profiles
set role = 'admin'
where email = 'the-admin-test-email';

update public.profiles
set role = 'super_admin'
where email = 'the-super-admin-test-email';
```

Refresh the page. The next request reads `profiles.role`. After one super admin exists, they can change other roles from a profile page instead of SQL.

Use clearly named development addresses for test accounts. While **Confirm email** is on in Supabase, each test account must confirm its email before it can sign in.

### Live member check

With **Confirm email** off, this signs up two `harbor.qa.member*` accounts against the real project and checks member access, RLS, and Storage rules. The password is random and is not printed. Each run leaves two accounts in Supabase Auth; delete them there when you are done.

```bash
node --experimental-websocket scripts/qa-live-member.mjs
```

### What to try

Member: open Dashboard and Directory. Other members can appear. Admin and super admin profiles should be absent, including when you open an id directly.

Admin: member and admin cards appear. A super admin URL should say you don't have permission.

Super admin: all three groups appear. You can rename another profile, change its role in the separate role section, and delete it. The image for that profile should be removed through Storage. The name form never changes a role.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npx supabase test db
node --experimental-websocket scripts/seed-test-users.mjs
node --experimental-websocket scripts/qa-live-member.mjs
```
