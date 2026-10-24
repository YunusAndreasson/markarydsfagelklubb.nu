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

Created by `supabase/migrations/20260919221326_hidden_alerts.sql` (step 4,
applied 2026-09-20):

| Object | Written by | Access (RLS) |
|---|---|---|
| `public.hidden_alerts` | the admin | read/insert/delete: `private.is_admin()`. **No `to anon` policy and no grant to anon**, so which larm the club has taken down is not anonymously enumerable. No UPDATE at all: hiding is an insert, showing again is a delete |

`hidden_alerts` has **no foreign keys**, on purpose. `alert_id → public.alerts`
would put a constraint on the app's own table and change what happens when a row
there is deleted; `hidden_by → auth.users` would block deleting the account of
anyone who had ever hidden a larm, breaking the app's `delete-account` function.
The cost is a row that may outlive its larm and hide nothing, which is harmless.

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

## The secret key (step 4)

The public larm feed publishes data from `alerts`, `observations`, `species`,
`locations` and `profiles`. **None of those is readable anonymously and their RLS
is not ours to change**, so the Worker reads them with a Supabase **secret key**
(`SUPABASE_SECRET_KEY`, an `sb_secret_*` value) — set with
`wrangler secret put`, and locally in `.dev.vars`. Never in `wrangler.jsonc`.
It replaced the retired app's leftover secret of the same name.

Two ways of getting that value **look like they work and do not**:

- `supabase projects api-keys` returns the secret **masked** — truncated and
  ending in `·` (U+00B7). It passes the `sb_secret_*` check and then fails every
  query with "Invalid API key". `scripts/set-admin-password.mjs` rejects it for
  exactly this reason; that guard is correct. Take the value from the dashboard.
- `wrangler secret put` run without a TTY reads EOF and **uploads an empty
  string**, reporting success. The Worker then logs
  `SUPABASE_SECRET_KEY is missing`. Run it in a real terminal and check it
  prints `Enter a secret value:`.

That key **bypasses RLS on this whole database**: every member's phone number,
every observation and every private storage object. What contains it:

- **One module holds it.** `src/lib/supabase-secret.ts` returns a client and a
  download function, never the key string, so it can't reach a log or a DTO.
- **One module uses it.** `src/lib/public-alerts.ts`, which returns `PublicAlert`
  DTOs and nothing else. It is never put on `App.Locals`, because an ambient
  client would be reachable from `/admin` requests, whose responses carry auth
  cookies.
- **Two tests enforce that.** `secret-key-scope.test.ts` walks `src/` and fails
  if anything else reaches the key, if a React island does, or if a larm route
  omits `prerender = false` — `astro build` prerenders inside workerd with
  `.dev.vars` loaded, so a prerendered larm page would read the real key on a
  developer's machine and write member data into `dist/` as a public asset.
  `alert-dto.test.ts` pins the published fields and the `select` string, and
  asserts that sentinel values for a user id, `image_path` and the coordinates
  don't survive serialisation.
- **The admin screen does not use it.** `/admin/larm` reads with the admin's own
  session (`alerts` is readable by `authenticated`) and writes `hidden_alerts`
  the same way, so RLS stays the boundary there.
- **Storage:** the key goes on both `apikey` and `Authorization: Bearer` for the
  Storage REST call, which is what supabase-js itself sends for REST and Storage.
  Since 2026-10-24 the same call can go to the **render endpoint**
  (`/storage/v1/render/image/authenticated/user-uploads/…`) for a resized larm
  photo, from the fixed sizes in `src/lib/alert-photo.ts`. It reads the same
  objects, so nothing about who can reach the key changed. Image
  transformations are a project setting (Storage → Settings) that the app
  doesn't use; switching it off costs the site only the small sizes, since the
  route then serves the original.
  The "new keys never use Bearer" rule in `CLAUDE.md` is about the *publishable*
  key on Auth routes, where a Bearer is read as a user JWT.

**Watch:** Workers Cache is off today, so hiding a larm propagates as soon as the
short browser TTLs expire. Switching on D4's route cache (`cacheCloudflare()`)
would let cached larm pages and photos survive a hide — that change has to purge
by tag or opt these routes out.

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
