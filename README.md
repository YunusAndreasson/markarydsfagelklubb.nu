# mafk-web

The new website for **Markaryds Fågelklubb**. It replaces the WordPress site at
[markarydsfagelklubb.nu](https://www.markarydsfagelklubb.nu) with a public site
and an admin area. It uses Astro on Cloudflare Workers, with a Supabase database
shared with the club's mobile app ([mafk-mobie](https://github.com/YunusAndreasson/mafk-mobie)).

- Production (until the domain cutover): https://mafk-web.jonas-268.workers.dev
- Pull requests get a preview at `https://pr-<n>-mafk-web.jonas-268.workers.dev`

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
| `pnpm types:db` | Regenerate database types after a migration |

## Deploying

Merging to `main` deploys through GitHub Actions and then runs a smoke test
(`scripts/smoke-test.sh`). The workflow needs two repository secrets:

- `CLOUDFLARE_API_TOKEN`: a token made from the *Edit Cloudflare Workers*
  template
- `CLOUDFLARE_ACCOUNT_ID`

## The database is shared

The mobile app is live on the same database, bird alerts included. Read
[docs/shared-database.md](docs/shared-database.md) before any schema work.
Migrations are never run by CI.

Agent and contributor conventions are in [CLAUDE.md](CLAUDE.md).
