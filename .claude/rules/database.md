---
paths:
  - "supabase/**"
  - "src/lib/supabase-*.ts"
  - "src/lib/database.types.ts"
  - "docs/shared-database.md"
---

# Shared-database rules

This project's database is shared with the **live** mobile app `../mafk-mobie`,
which runs bird reports and bird alerts on it every day. The full inventory and
reasoning are in `docs/shared-database.md`; read it before changing anything
here.

- **Existing objects are not ours.** Never alter, drop, rename, re-grant or
  re-policy `profiles`, `species`, `locations`, `observations`, `alerts`,
  `expo_push_tokens`, `push_subscriptions`, the `user-uploads` bucket,
  `private.is_admin()` or the `drizzle` schema without the user explicitly
  approving that specific change. An "additive" column still counts.
- **Never `FORCE ROW LEVEL SECURITY` on an existing table.** Do force it on every
  new table this repo creates.
- New tables: RLS enabled and forced in the same migration that creates them;
  every policy wraps `(select auth.uid())` / `(select private.is_admin())`;
  every column a policy reads has an index; no `for all … using (true)`.
- `security definer` helpers go in `private`, with `set search_path = ''`,
  `revoke execute … from public, anon` and `grant execute … to authenticated`.
  Revoking from `authenticated` breaks every policy that calls the helper.
- Public site content needs explicit `to anon` select policies, scoped to
  published rows. Nothing in the database is anonymously readable today.
- Migrations are plain SQL, timestamped, **re-runnable** (`if not exists`,
  `drop policy if exists` before `create policy`, `create or replace`), and
  commented with the *why*. Use `/new-migration`.
- Load the `supabase-postgres-best-practices` skill before writing SQL.
- Never run `supabase config push`, `supabase db reset`, `supabase db pull`, or
  `supabase functions deploy|delete` from this repo. CI never migrates.
- After a push: run `pnpm types:db`, then `get_advisors` for security and
  performance.
