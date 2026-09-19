# The shared Supabase database

This site does not get a database of its own. It shares Supabase project
**`zgnmajovyqibgxlcomvb`** (`mafk`, eu-north-1 Stockholm, Postgres 17) with the
**live** Expo app in `../mafk-mobie`. Members report birds and receive bird
alerts (*larm*) through that app every day. A mistake here is a production
incident in someone else's pocket.

The inventory below was read from the live database on 2026-09-19. Re-read it
(Supabase MCP `list_tables`, `pg_policies`, `list_edge_functions`) before you
rely on it for a change.

## What already exists — and who owns it

| Object | Written by | Access (RLS) | Status |
|---|---|---|---|
| `public.profiles` | app (own row) | read: authenticated · write: own row. `is_admin` is readable, but clients can't insert or update it | **live** |
| `public.species` | service role (seeded) | read: authenticated | **live** |
| `public.locations` | admins | read: authenticated · insert: `private.is_admin()` | **live** |
| `public.observations` | app (own rows) | read: authenticated · write/delete: own | **live** |
| `public.alerts` | `send-bird-alert` edge function (service role) | read: authenticated | **live: the alert log** |
| `public.expo_push_tokens` | app (own rows) | own rows only | **live: alert delivery** |
| `public.push_subscriptions` | nothing (0 rows) | own rows only | left over from the retired web app |
| `private.is_admin()` | — | `security definer`, reads `profiles.is_admin` | **live**, used by the `locations` policy |
| storage bucket `user-uploads` (private) | app, under `${uid}/` | read: authenticated · write: own folder | **live**: observation photos and avatars |
| edge function `send-bird-alert` | invoked by the app after an insert | — | **live**: fans alerts out through Expo push |
| edge function `delete-account` | invoked by the app | — | **live**: App Store requirement |
| schema `drizzle` (`__drizzle_migrations`) | nothing | — | left over from the retired web app |

## What this repo owns

Created by `supabase/migrations/20260919203847_content_core.sql` (step 3,
applied 2026-09-19). The app doesn't read any of it.

| Object | Written by | Access (RLS) |
|---|---|---|
| `public.categories` | the admin | read: everyone · write: `private.is_admin()` |
| `public.articles` | the admin | read: anon only published and due (`status = 'published' and published_at <= now()`), the admin everything · write: admin |
| `public.pages` | the admin | the same rule as articles. The page tree and the menu (`kind` `page` or `link`) |
| `public.media` | the admin's browser, on upload | read: anon only the covers of visible articles, the admin everything · write: admin |
| `private.touch_updated_at()` | — | trigger function on `articles` and `pages`; EXECUTE revoked from everyone |
| storage bucket `site-media` (public) | the admin's browser | public URLs need no policy. `site_media_{select,insert,delete}_admin` on `storage.objects`, each scoped to `bucket_id = 'site-media'`. WebP/JPEG only, 5 MB per file |

The new tables start from `revoke all … from anon, authenticated`, because the
project's default privileges would otherwise give both every privilege,
TRUNCATE included, which RLS doesn't cover. anon then gets `select`, and
authenticated gets `select, insert, update, delete`, which RLS narrows to the
admin.

What else is true today:

- **Only this repo's tables are readable anonymously.** Every policy on the
  app's tables targets `authenticated` or an owner.
- **No table has `FORCE ROW LEVEL SECURITY`**, and none of them should get it
  from this repo.
- **There are no database triggers, no `pg_net`, no `pg_cron`.** The alert
  pipeline is: the app inserts the observation, the app invokes
  `send-bird-alert`, the function writes `alerts` and pushes through Expo. None
  of it passes through this site's Worker, so deploying the site cannot break it.
  *Changing these tables or that function can.*
- **One admin:** Jonas (`yunus@edenmind.com`), the site's only web
  administrator, granted 2026-09-19 with `supabase db query --linked`. The flag
  is shared with the app, where it also allows creating lokaler. Grant or revoke
  it only with SQL, and only when the user asks for that specific change.
- The mobile repo keeps its own SQL under `../mafk-mobie/supabase/` and applies
  it with `supabase db query --linked -f …`. That writes **no** migration
  history. Its edge functions are deployed from there too.

## Rules for this repo

1. **Never alter, drop, rename or re-policy an existing object** in the table
   above without the user explicitly approving that specific change. Adding a
   column that the app ignores still counts. The app's queries and generated
   types are in another repo, and you cannot see them break.
2. **New tables are this repo's.** They get plain, idempotent SQL in
   `supabase/migrations/<timestamp>_<name>.sql`, applied with `supabase db push`.
   Load the `supabase-postgres-best-practices` skill first and follow
   `/new-migration`.
3. **On new tables, RLS is on from the first migration**, with
   `force row level security`, policies wrapped as `(select auth.uid())`, an
   index on every column a policy reads, and helpers in `private` with
   `set search_path = ''`. Authorisation for the admin reuses the existing
   `private.is_admin()`; don't create a second admin concept.
4. **Never run from this repo:**
   - `supabase config push`: `supabase/config.toml` holds CLI defaults (Apple
     and Google sign-in *off*, `site_url` localhost). Pushing it switches off
     sign-in for the live app.
   - `supabase db reset --linked`: this wipes the production database.
   - `supabase functions deploy|delete`: the functions belong to
     `../mafk-mobie`.
   - `supabase db pull` followed by a push: a pulled "remote schema" migration
     would claim ownership of objects this repo doesn't own.

   `.claude/settings.json` denies these.
5. **CI never migrates.** A human runs `supabase db push`, after a
   `--dry-run`, and then regenerates types with `pnpm types:db`.
6. **The mobile repo must never run `supabase db push`.** Once this repo has
   pushed, the remote history contains versions that the mobile repo's
   `supabase/migrations/` doesn't have, and the CLI refuses. Its convention
   (`db query --linked`) is fine to keep.

## Auth configuration

The remote auth settings are what the dashboard and earlier pushes left behind.
No repo currently holds an accurate copy of them. What is known (2026-09-19):

- `site_url` is `https://mafk-web.jonas-268.workers.dev` (this site's Worker
  URL, inherited from the retired web app).
- The app signs in with Apple and Google through native ID tokens. The Google
  provider has **no OAuth secret**, so Google sign-in does not work on the web
  as configured (`/auth/v1/authorize` answers "missing OAuth secret").
- The email provider is on, **sign-up is open and `mailer_autoconfirm` is on**.
  Anyone can create an account, which is why a session alone never opens
  `/admin`: the gate also checks `profiles.is_admin`.
- The site's admin signs in with **email and password** through that existing
  provider (step 2). That needed no auth config change and has no callback URL.
  The password is set with `pnpm admin:password <email>`.

## Leftovers from the retired web app

Nothing in this repo touches the `drizzle` schema or `public.push_subscriptions`.
Both are candidates for a later cleanup migration, and only with the user's
explicit go-ahead.
