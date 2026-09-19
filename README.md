# mafk-web

The new website for **Markaryds Fågelklubb**. It replaces the WordPress site at
[markarydsfagelklubb.nu](https://www.markarydsfagelklubb.nu) with a public site
and an admin area. It uses Astro on Cloudflare Workers, with a Supabase database
shared with the club's mobile app ([mafk-mobie](https://github.com/YunusAndreasson/mafk-mobie)).

Production (until the domain cutover): https://mafk-web.jonas-268.workers.dev

## Setup

Requires Node ≥ 22.12, pnpm 11 and the Supabase CLI.

```bash
pnpm install
npx skills experimental_install      # restore agent skills from skills-lock.json
supabase login                       # once per machine
supabase link --project-ref zgnmajovyqibgxlcomvb
pnpm dev                             # http://localhost:4321
```

The public Supabase URL and publishable key are in `wrangler.jsonc`, so no
`.dev.vars` is needed yet (see `.dev.vars.example`).

## Everyday commands

| Command | What |
|---|---|
| `pnpm dev` | Astro dev server |
| `pnpm preview` | Production build served by `wrangler dev`, with real headers and routing |
| `pnpm verify` | Lint, typecheck, tests, build: what CI runs |
| `pnpm ship` | Deploy to production from this machine |
| `pnpm types:db` | Regenerate database types after a migration |

## The admin area

`/admin` is for the club's one administrator, who signs in with email and
password. Set or reset the password in your own terminal (it prompts, and
prints nothing secret):

```bash
pnpm admin:password yunus@edenmind.com
```

Access needs `profiles.is_admin = true` on that account as well, granted with
SQL. See [docs/shared-database.md](docs/shared-database.md).

## Deploying

Shipping happens from your own machine, never from CI:

```bash
wrangler login     # once per machine (pnpm exec wrangler login)
pnpm ship          # clean main only: verify → wrangler deploy → smoke test
```

GitHub Actions runs `pnpm verify` on every push and PR, but it doesn't deploy,
so no Cloudflare credential is stored in GitHub.

## The database is shared

The mobile app is live on the same database, bird alerts included. Read
[docs/shared-database.md](docs/shared-database.md) before any schema work.
Migrations are never run by CI.

Agent and contributor conventions are in [CLAUDE.md](CLAUDE.md).
