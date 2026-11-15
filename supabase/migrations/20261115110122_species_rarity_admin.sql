-- The website's admin sets each species' larmlista number (rarity, 0–5) on
-- /admin/arter. `species` belongs to the live app (docs/shared-database.md);
-- the user approved this specific change on 2026-11-15.
--
-- Nothing the app does changes: it only reads species, and the alert function
-- (send-bird-alert) never looks at rarity. The app shows a new number on its
-- next read.

-- Supabase's default privileges gave anon and authenticated UPDATE on every
-- column; until now only the missing update policy kept them out. Narrow the
-- grant first, so the policy below can only ever reach `rarity`: an admin's
-- session can't rename a species or move its sort order by accident.
revoke update on table public.species from anon, authenticated;
grant update (rarity) on table public.species to authenticated;

-- Admins only, by the same flag the app and the rest of the site use. The
-- existing species_rarity_check keeps the value to 0–5 (or null: unlisted).
drop policy if exists species_update_admin on public.species;
create policy species_update_admin on public.species
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
