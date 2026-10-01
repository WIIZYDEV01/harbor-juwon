# Harbor — implementation plan

Status: **approved and implemented in code**. Both SQL scripts are applied to the hosted project. Live signed-in checks for each role are still pending.

The SQL already given matches the database that exists today. It does not include the admin dashboards, search, activity log, or dedicated role change in the latest brief. Those are proposed below.

## 1. Project audit

Inspected the Harbor app on 2026-09-30.

| Area | What exists |
| --- | --- |
| Stack | Next.js 16 App Router, React 19, TypeScript, Tailwind 4, `@supabase/ssr` |
| Auth | Email/password sign-up, sign-in, sign-out. Guests can open only `/login`, `/signup`, and `/auth/*`. Home redirects to sign-in. |
| Session | Cookie session in `proxy.ts`. Server reads use the user JWT. |
| Profiles | `public.profiles` with role enum, column lock trigger, signup trigger, least-privilege RLS, column grants that hide `email` from authenticated SELECT |
| Images | Private bucket `profile-images`. Upload, replace, and delete in My Profile. Bytes are streamed from `GET /api/profile-image/[id]` with the user session. |
| Screens | Dashboard, directory, own profile, profile detail, unauthorized |
| Look | Three colors only: ink `#1C1917`, paper `#F6F3EE`, clay `#8E3B2E` |
| Tests | pgTAP files for profile and storage RLS. They have not been executed here because Docker is not installed. |
| Hosted database | The profiles table now exists. An anonymous request returns `42501 permission denied for table profiles`. That is the intended denial. The signed-in dashboard has not been rechecked since that result. |

The earlier “Unable to load profiles” error was `PGRST205`: the table was missing. The script fixed that cause. It should be run only once.

## 2. Existing implementation to keep

Do not replace the app. Keep:

- Auth gate, sign-out, and session cookies
- Roles `member`, `admin`, `super_admin`
- Signup always creates `member`. The form has no role field.
- Trigger blocks changes to `id`, `user_id`, `role`, `email`, and `created_at` for `authenticated` and `anon`
- Member reads members. Admin reads members and admins. Super admin reads everyone.
- Admin does not edit or delete other people. Super admin may edit `full_name` and delete a profile.
- Image cleanup uses the Storage API after RLS deletes the row. SQL does not delete `storage.objects`.
- Service role stays server-only and is not used to decide whether a delete is allowed
- No mock people, counts, or activity
- Three-color Harbor identity

## 3. Architecture

```
Browser
  → Next.js Server Components and Server Actions
    → Supabase user JWT
      → Postgres RLS on profiles and profile_activity
      → Storage RLS on profile-images
```

The interface may hide a button. The database still decides. Queries select only the columns the screen needs. They do not load every profile and hide rows in React.

## 4. Database schema

Keep `public.profiles` as it is.

Add one table after approval:

`public.profile_activity`

| Column | Purpose |
| --- | --- |
| `id` | uuid primary key |
| `actor_user_id` | who did it |
| `action` | `profile_created`, `profile_updated`, `profile_deleted`, `image_uploaded`, `image_replaced`, `image_deleted`, `role_changed` |
| `target_user_id` | whose profile |
| `target_role` | role of the target at that moment, so a later delete does not hide the event from the wrong audience |
| `created_at` | timestamp |

No passwords, tokens, or email addresses in this table. A security-definer trigger on `profiles` writes the row. Image actions are detected from `avatar_url` changes.

## 5. Authentication

Unchanged. Sign up, sign in, sign out, persistent session, protected routes. A missing session goes to `/login`. A signed-in visit to `/login` or `/signup` goes to `/dashboard`.

## 6. Role model

Source of truth remains `profiles.role`. Signup metadata cannot choose a role. The normal profile form never includes `role` or `user_id`.

New, separate from profile editing: super admin may change another person’s role through one database function, `set_profile_role(target_user_id, new_role)`. The function runs as its owner, checks that the caller is a super admin, refuses to change the caller’s own role, and writes an activity row. The existing column-lock trigger still blocks a normal update of `role`.

Promoting the first admin and super admin for testing stays a SQL editor or seed script step, not a signup option.

## 7. Permission matrix

| Action | Member | Admin | Super admin |
| --- | --- | --- | --- |
| Own profile CRUD | Yes | Yes | Yes |
| Other member profiles | Name, role, image | Yes | Yes |
| Other admin profiles | No | Read only | Read, edit name, delete |
| Super admin profiles | No | No | Read, edit name, delete |
| Own image CRUD | Yes | Yes | Yes |
| Member images | Yes | Yes | Yes |
| Admin images | No | Yes | Yes |
| Super admin images | No | No | Yes |
| Change own role | No | No | No |
| Change another user’s role | No | No | Dedicated function only |
| Change `user_id` | No | No | No |
| Admin dashboard counts and directory | No | Yes, within RLS | Yes |
| Activity log | No | Member and admin events only | All events |

## 8. RLS strategy

Leave the four profile policies in place. Do not disable RLS. Do not add `FOR ALL`.

`profile_activity` gets SELECT only:

- super admin reads every row
- admin reads rows whose `target_role` is `member` or `admin`
- member and anon read nothing

Inserts happen inside the security-definer trigger and role function, not from the browser.

## 9. Storage strategy

Keep the private `profile-images` bucket, 2 MB, JPEG/PNG/WEBP, path `{user_id}/avatar.jpg|png|webp`. Display stays on the authenticated image route. No public URLs.

## 10. CRUD implementation

Keep the current server actions: create, update own name, super-admin name update, delete with storage cleanup, upload, replace, delete image.

Add only `set_profile_role` as its own action. It is not part of the name form.

## 11. Admin dashboard

Same `/dashboard` route. The page branches on the signed-in role. An admin sees:

- counts of visible members, visible admins, their own profile, and visible profiles that have an image
- a directory of those visible people

Counts are `count` queries under the user JWT. They are not invented numbers and they are not loaded with the service role.

## 12. Member dashboard

Welcome line with the profile name, own photo, role badge, profile completion (name and photo present or missing), links to My Profile and the directory, and the member list. No admin counts. No activity log.

## 13. Super-admin capabilities

The same dashboard adds super-admin counts, the full visible directory, the activity list, name edit, delete, and the separate role control. Ordinary profile editing still cannot set `role` or `user_id`.

## 14. Profile image management

Keep upload, replace, delete, preview, type and size checks, and confirmation before delete. After approval, verify on the live project that a file lands in Storage, `avatar_url` stores the path, the photo renders, replace works, and delete works. Fix only what that check shows is broken.

## 15. Search and filter

Directory accepts `q` and `role` in the URL.

- `q` becomes `ilike` on `full_name` in the query
- `role` becomes `eq` on `role` only when that role is one this account may see
- a member or admin who asks for `super_admin` gets an empty list from the query, not a hidden React filter

Pagination is 20 rows, using range, so the page does not load the whole table.

## 16. Audit and activity

The activity table in section 4. Members do not see it. Admins see member and admin events. Super admins see all events. The list is part of the admin and super-admin dashboards.

## 17. Error handling

People still see “Unable to load profiles.” The server logs `code`, `message`, `details`, and `hint`. Raw Postgres text stays off the page. Empty lists say “No members yet.” Destructive actions keep the existing confirmation dialog, not `alert()`.

## 18. Accessibility

Keep labels, focus rings, dialog semantics, alt text, and the skip link. Role is shown with text, not color alone: outline for member, solid ink for admin, solid clay for super admin.

## 19. Responsive design

Desktop and laptop: sidebar plus a table for the directory. Tablet and mobile: the existing menu drawer, and the same people as stacked cards. No horizontal page overflow. Touch targets stay at least 44px.

## 20. Testing strategy

After implementation:

- sign in as the existing member and confirm the dashboard loads a real row
- create, edit, and delete own name
- upload, replace, and delete a JPEG, PNG, or WEBP at or under 2 MB
- search and filter the directory
- confirm a member cannot open an admin or super-admin profile
- promote two test users with SQL, then repeat the matrix for admin and super admin
- confirm the role control is absent for member and admin

## 21. Security testing

Extend the existing pgTAP files for the activity SELECT rules and for `set_profile_role` (super admin allowed, member and admin denied, own-role change denied, `user_id` still locked). `supabase test db` still needs Docker or a hosted database URL. It will be run if that access exists. Until then, the report will say the tests were not executed.

## 22. Build and QA checklist

`npx tsc --noEmit`, `npm run lint`, and `npm run build`. Then the signed-in paths `/dashboard`, `/profiles`, `/profile`, and a profile detail page. Also mobile width and desktop width.

## 23. Deployment considerations

The hosted Supabase project is already connected through `.env.local`. Required names, not values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` for deleting another person’s image after a super-admin profile delete

The new migration will be a third SQL file. It will not repeat the script already run. Email templates in `supabase/templates/` apply to a local Supabase stack. The hosted project still uses Supabase’s own templates until they are pasted in Authentication → Email Templates.

## Design upgrade

Keep the three Harbor colors. Take the structure used by current admin products: a quiet sidebar, a short stat row, a search field, and a dense directory table. Do not copy a specific product’s layout, type, or illustrations. Do not add a fourth color, stock photos, or fake statistics.

## Approval needed before code

1. Add `profile_activity` and the trigger.
2. Add `set_profile_role` for super admin only, never for the caller’s own role.
3. Rebuild the dashboard, directory, and profile screens inside the current three colors, with search, filter, and the activity list for admins and super admins.
4. Verify image upload against the live bucket after those changes.
