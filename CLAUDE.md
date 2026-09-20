# mafk-web

The website for **Markaryds Fågelklubb**. It replaces the WordPress site at
markarydsfagelklubb.nu with a public site and an admin area (the CMS). All UI
copy is **Swedish** (`<html lang="sv">`, no English fallbacks). Code,
comments and docs are English.

**Status: step 5 — kalender.** On top of the stack, the Supabase wiring,
CI, local shipping and the gated `/admin` that exactly one administrator signs
in to (email + password), the site has its own tables (pages, articles,
categories, media, events) and the `site-media` bucket; `/admin` edits them
with a Tiptap editor, and the public site renders them. The article, page and
event content is dummy (`exempel-` slugs) until the WordPress import in step 8.
**Step 4 added the public larm feed** (`/larm`), which publishes the live app's
alert log — real member data, read with the site's first Worker secret.
**Step 5 added the kalender**: `/kalender` and `/kalender.ics`, the club's own
programme, with no member data in it. Don't build features ahead of the step
you've been asked for. The full agenda, the
decisions and the step order are in `docs/roadmap.md`; plan a step from its
section there. The public site's design is in `docs/design.md`.

**The larm feed is the one place this site publishes members' own data.** Read
the secret-key section of `docs/shared-database.md` before touching anything
under `src/lib/{public-alerts,supabase-secret,alert-*}.ts` or `src/pages/larm/`.
Two tests hold the line — `secret-key-scope.test.ts` (who may reach the key)
and `alert-dto.test.ts` (what may be published) — and neither should be relaxed
to make a change compile.

**Admin access**: `src/lib/admin-access.ts` holds the whole policy (unit
tested), `src/middleware.ts` applies it to every `/admin*` request. A session
alone never opens `/admin`, because sign-up is open for the app; the gate also
reads `profiles.is_admin` with the user's own session. RLS stays the real
boundary for data.

Sibling repos: `../mafk-mobie` is the **live** Expo app that uses the same
database. `../mafk` is the old TanStack web app, now retired, whose Worker
name this site took over; don't copy from it. `../mhf` is the reference stack
that this repo mirrors.

## Stack

| Layer | Choice |
|---|---|
| Framework | Astro 7, `output: "static"` + per-route `export const prerender = false` |
| Host | Cloudflare **Workers** (static assets + SSR) via `@astrojs/cloudflare` |
| UI | shadcn/ui on **Base UI** (`base-luma`), Tailwind 4, React 19 islands, lucide icons |
| Data | Supabase, **shared with the live app**: project `zgnmajovyqibgxlcomvb` |
| Tooling | pnpm 11, Biome, Vitest, `astro check`, TypeScript 6 (7 breaks `@astrojs/check`) |

## Commands

| Command | What |
|---|---|
| `pnpm dev` | Astro dev server |
| `pnpm preview` | `astro build && wrangler dev`, which serves `public/_headers` and the real Worker. Use it for anything header-, CSP- or routing-related |
| `pnpm verify` | Biome + `wrangler types` + `astro check` + Vitest + build. **Run it before calling anything done**; CI runs exactly this |
| `pnpm check:fix` | Biome autofix |
| `pnpm test` | Vitest (pure modules in `src/**/*.test.ts`) |
| `pnpm types:db` | Regenerate `src/lib/database.types.ts` from the shared project (generated: never hand-edit) |
| `pnpm ship` | **The only deploy path.** Needs a clean `main`; runs verify, `wrangler deploy` (logged-in OAuth), then the smoke test. Only when the user asks |
| `scripts/smoke-test.sh <url>` | Home page + `/api/health` must be ok |
| `pnpm admin:password <email>` | Set the admin's password. **The user runs it** in their own terminal (hidden prompts); never run it or handle the password yourself |
| `supabase db query --linked -f scripts/dummy-content.sql` | Load the dummy articles and pages (`exempel-` slugs). `dummy-content-delete.sql` removes them, and runs before the WordPress import. Writes only this repo's tables |

Production is https://mafk-web.jonas-268.workers.dev, shipped **from the
developer's machine only**. CI (`.github/workflows/ci.yml`) runs `pnpm verify`
on every push and PR and never deploys, so no Cloudflare credential lives in
GitHub. Don't call `wrangler deploy` directly; `pnpm ship` ties every live
version to a commit.

## The shared database — read before touching data

The live app's members report birds and receive **bird alerts** through this
database. Deploying the site can't affect them, but changing the database can.
**Read `docs/shared-database.md` before any schema, RLS or Supabase work.**
In short:

- **Never alter, drop, rename or re-policy an existing object** (`profiles`,
  `species`, `locations`, `observations`, `alerts`, `expo_push_tokens`, the
  `user-uploads` bucket, `private.is_admin()`, the edge functions) without the
  user's explicit approval for that specific change.
- New tables for the site live in `supabase/migrations/`, as plain idempotent
  SQL, applied by a human with `supabase db push`. **CI never migrates.** Use
  `/new-migration`.
- **Never run** `supabase config push` (it would switch off the app's sign-in),
  `supabase db reset`, or `supabase functions deploy|delete`. They are denied
  in `.claude/settings.json`.
- Admin authorisation reuses the existing `private.is_admin()`
  (`profiles.is_admin`). No second admin concept.

## Non-negotiables

**Supabase keys and auth**

- New API keys only: `sb_publishable_*` goes to the browser and lives in
  `wrangler.jsonc` `vars`; `sb_secret_*` belongs only in Worker secrets
  (`SUPABASE_SECRET_KEY`, added in step 4 for the larm feed — see
  `docs/shared-database.md`). The publishable key goes on the `apikey` header,
  **never** `Authorization: Bearer`, where Auth would read it as a user JWT.
  The one exception is the secret key on a raw Storage or REST call, which
  carries both headers because that is what supabase-js itself sends
  (`src/lib/supabase-secret.ts`).
- Verify sessions with `getClaims()` (local JWT check), not `getUser()`
  (an Auth round trip per request).
- **Never default a missing value.** `src/lib/env.ts` reports problems, and
  callers return 500 `server_misconfigured` and log which value. No
  `SECRET || publishable` fallbacks. It also refuses a secret key in the
  publishable slot.
- One server client **per request** (`src/lib/supabase-server.ts`). Copy its
  `authResponseHeaders` onto the response, or a CDN can serve one user's session
  to the next.

**Platform**

- `wrangler.jsonc` is the **source of truth for bindings**; dashboard config
  stops applying once it exists. Secrets go through `wrangler secret put`,
  never the file.
- Bindings come from `import { env } from "cloudflare:workers"`, wrapped in
  `src/lib/worker-env.ts`. `Astro.locals.runtime` was removed.
- `run_worker_first` stays the **array** form: `["/*", "!/_astro/*", …]`.
  Every page runs the Worker first; the static files are excluded, one `!`
  entry each. **A new file in `public/` needs its own exclusion**, or every
  request for it costs a Worker invocation. `_redirects` never applies to
  Worker responses, so old-URL redirects live in the Worker (roadmap D6).
- Astro sessions are off (`session: false`) and images compile at build
  (`imageService: "compile"`). The adapter defaults would provision a KV
  namespace and a billable Images binding.
- Every network call gets a deadline (`createFetchWithTimeout` in
  `src/lib/fetch.ts`). Neither `fetch` nor supabase-js has one.
- Security headers exist twice, in `public/_headers` for static assets and in
  `src/lib/security-headers.ts` for Worker responses. A test keeps them
  identical, so change both together.

**Gotchas already paid for in sibling repos**

- Supabase caps API responses at **1000 rows**. Page with keysets, not offsets.
- `request.json()` resolves for `null`, so reject non-objects explicitly.
- A path regex is not an open-redirect guard: `//evil.example/x` matches
  `^/[\w\-./]*$`. Resolve `next` against the origin and compare `.origin`.
- Sign-out and other state changes are **POST**, never GET.

## Rendering discipline

Public pages are `.astro`, **server-rendered from the database** through the
Worker (roadmap D4), with **zero client JS by default**. They read with
`locals.db`, the publishable key and no session, so what they can see is
exactly what the `to anon` policies allow, and they send
`Cache-Control: public, max-age=60`. Only the 404 is prerendered, and it must
never query. Hydrate only the narrowest interactive leaf, using
`client:visible` or `client:idle` (`client:load` only when it must be
immediate); today the only islands are the admin's editor and uploader
(`client:only`). `/admin/*` is SSR with `Cache-Control: private, no-store`.
Everything but prerendered pages passes through `src/middleware.ts`.

Article and page bodies are **sanitized on save** (`src/lib/sanitize.ts`), never
on render. The sanitizer's allowlist and the editor's extensions
(`src/components/admin/editor-extensions.ts`) must match, and
`editor-roundtrip.test.ts` checks that they do. UI conventions (shadcn, Base UI, tokens) are in
`.claude/rules/ui.md` and load when you touch components or pages.

Until launch, every page carries `noindex` and `public/robots.txt` disallows
all. Both come out together at the domain cutover.

## Definition of done

1. `pnpm verify` passes.
2. For anything visible, or anything about headers/CSP/routing: check it with
   `pnpm preview` **in Zen (Gecko)**, the browser the user actually uses (see
   `~/.claude/rules/browser.md`). Chromium is a second data point, never the
   only one.
3. For schema work: `get_advisors` (security + performance) shows nothing new,
   and types are regenerated.

## Skills

Project skills live in `.claude/skills/`. Third-party ones are tracked in
`skills-lock.json` (the cache is gitignored; restore with
`npx skills experimental_install`, update with `npx skills update`):
`supabase`, `supabase-postgres-best-practices`, `shadcn`, and the Astro set
(`astro-best-practices`, `docs-lookup`, `create-component`, `add-integration`,
`migrate`). Authored here: `/new-migration`.

**Load `supabase-postgres-best-practices` before writing any migration, RLS
policy or index. Load `shadcn` before writing UI. Load `frontend-design` for
every design task** (anything visible: pages, layouts, components, on-screen
copy), and follow its plan → review → build → critique process. The brand
tokens (Markaryd green, Inter) are shared with the app and stay fixed; the
design work is layout, type scale, copy and the site's character.

The global `cloudflare`, `wrangler`, `workers-best-practices` and `web-perf`
skills apply too. Prefer retrieval over memory for Astro, Cloudflare and
Supabase APIs, because all three move fast.
