---
name: new-migration
description: Write and apply a database migration for this site's own tables in the Supabase project shared with the live mafk-mobie app. Use whenever a task needs a new table, column, index, policy, function or grant — before writing any SQL.
argument-hint: "<short_snake_case_name> — what the migration does"
---

# New migration (shared, live database)

The database belongs to the live bird-reporting app as much as to this site.
Read `docs/shared-database.md` first. Every step below exists because skipping
it can break members' reports or alerts, which you won't see from this repo.

## 1. Scope check

- List every object the migration touches. If any is on the **existing
  objects** list in `docs/shared-database.md` (`profiles`, `species`,
  `locations`, `observations`, `alerts`, `expo_push_tokens`,
  `push_subscriptions`, `user-uploads`, `private.is_admin()`, `drizzle`), stop
  and get the user's explicit approval for that specific change before writing
  anything.
- Check the live state instead of trusting memory: Supabase MCP `list_tables`
  (verbose) and `execute_sql` with a read-only `select` from `pg_policies` or
  `information_schema`.

## 2. Write it

- Load the `supabase-postgres-best-practices` skill.
- File: `supabase/migrations/$(date -u +%Y%m%d%H%M%S)_<name>.sql`.
- It must be **re-runnable**: `create table if not exists`,
  `create or replace function`, `drop policy if exists` before every
  `create policy`, and `add column if not exists`.
- Every new table in the same file gets
  `alter table … enable row level security;` +
  `alter table … force row level security;`, then its policies:
  - `(select auth.uid())`, `(select private.is_admin())`, always wrapped in
    `select`.
  - Explicit roles (`to anon`, `to authenticated`), and one policy per command.
    Never `for all … using (true)`.
  - Public content: `to anon, authenticated` select, limited to published rows.
  - Writes: `to authenticated` with `(select private.is_admin())`.
- Index every column a policy or a foreign key reads.
- A new `security definer` helper goes in `private`, with
  `set search_path = ''`, `revoke execute … from public, anon`, and
  `grant execute … to authenticated`.
- Comment the *why* above each block, not the what.

## 3. Review, then apply (a human decision)

1. `supabase db push --dry-run`: confirm it lists **only** the new file(s).
2. Show the user the SQL and the dry-run output and wait for an explicit go.
   `supabase db push` is set to *ask* in `.claude/settings.json`; never work
   around that.
3. `supabase db push`
4. `pnpm types:db`, then `pnpm verify`.
5. Supabase MCP `get_advisors` for `security` and for `performance`: fix
   anything new that the migration introduced.
6. Commit the migration and the regenerated `src/lib/database.types.ts`
   together.

## Never

`supabase db reset`, `supabase db pull`, `supabase config push`,
`supabase migration repair` on versions this repo doesn't own, or running SQL
from CI.
