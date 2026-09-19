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
| `public.profiles` | app (own row) | read: authenticated · write: own row; `is_admin` column is revoked from clients | **live** |
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

What else is true today:

- **Nothing is readable anonymously.** Every policy targets `authenticated` or
  an owner. The public site's tables will be the first with `anon` read
  policies.
- **No table has `FORCE ROW LEVEL SECURITY`**, and none of them should get it
  from this repo.
- **There are no database triggers, no `pg_net`, no `pg_cron`.** The alert
  pipeline is: the app inserts the observation, the app invokes
  `send-bird-alert`, the function writes `alerts` and pushes through Expo. None
  of it passes through this site's Worker, so deploying the site cannot break it.
  *Changing these tables or that function can.*
- **No user has `profiles.is_admin = true` yet** (0 rows). The admin-login step
  must grant the first admins deliberately, using the SQL editor or a migration
  and never the app.
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
No repo currently holds an accurate copy of them. As of today, `site_url` is
`https://mafk-web.jonas-268.workers.dev` (this site's Worker URL, inherited
from the retired web app), and the app signs in with Apple and Google through
native ID tokens. The admin-login step reconciles this: it reads the live
settings, decides the web sign-in method, and adds this site's callback to
`additional_redirect_urls` as one reviewed change.

## Leftovers from the retired web app

Nothing in this repo touches the `drizzle` schema or `public.push_subscriptions`.
Both are candidates for a later cleanup migration, and only with the user's
explicit go-ahead.
