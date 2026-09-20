-- Step 4, larm på webben: `hidden_alerts`, the only new object the public
-- alert feed needs (docs/roadmap.md, F4).
--
-- The feed itself reads the live app's `alerts`, `observations`, `species`,
-- `locations` and `profiles`. **None of them is touched here**, and none of
-- them gains an anon policy: the Worker reads them with a secret key instead
-- (D1), so the app's access rules stay exactly as they are.
-- Re-runnable: see .claude/skills/new-migration.


-- One row per larm the administrator has taken off the website: an opt-out a
-- member asked for, a protected species, or a plain mistake. The public feed,
-- the home page and the photo route all consult it before showing anything.
create table if not exists public.hidden_alerts (
  alert_id uuid primary key,
  reason text not null default '',
  hidden_at timestamptz not null default now(),
  hidden_by uuid
);

-- Deliberately NO foreign keys:
--
--   alert_id -> public.alerts   would put a constraint on the live app's own
--                               table and change what happens when a row there
--                               is deleted. .claude/rules/database.md forbids
--                               altering their objects, an "additive" change
--                               included.
--   hidden_by -> auth.users     would block deleting the account of anyone who
--                               had ever hidden a larm, breaking the app's
--                               delete-account edge function.
--
-- The cost is a row that may outlive its larm and hide nothing, which is
-- harmless. Either constraint would reach into someone else's feature.
--
-- No extra index either: the primary key answers the only lookup there is, and
-- the table holds a handful of rows.
comment on table public.hidden_alerts is
  'Larm hidden from the public website by the administrator. Owned by mafk-web; the mobile app never reads it. No foreign key to public.alerts on purpose - see supabase/migrations/20260919221326_hidden_alerts.sql.';


-- Privileges. The project's default privileges hand anon and authenticated
-- every privilege on a new table, TRUNCATE included, which RLS does not cover.
--
-- anon is given nothing at all. The public pages read this table with the
-- secret key, so which larm the club has taken down never becomes anonymously
-- enumerable. service_role is left as it is — it holds the default grants and
-- the BYPASSRLS attribute, which is how the Worker reads the table.
--
-- No UPDATE: hiding a larm is an insert, showing it again is a delete. There
-- is no third state to edit.
revoke all on public.hidden_alerts from anon, authenticated;
grant select, insert, delete on public.hidden_alerts to authenticated;


-- Row level security. The administrator only, one policy per command, and no
-- anon policy — with no grant to anon there would be nothing for one to match.
alter table public.hidden_alerts enable row level security;
alter table public.hidden_alerts force row level security;

drop policy if exists hidden_alerts_select_admin on public.hidden_alerts;
create policy hidden_alerts_select_admin on public.hidden_alerts
  for select to authenticated using ((select private.is_admin()));

drop policy if exists hidden_alerts_insert_admin on public.hidden_alerts;
create policy hidden_alerts_insert_admin on public.hidden_alerts
  for insert to authenticated with check ((select private.is_admin()));

drop policy if exists hidden_alerts_delete_admin on public.hidden_alerts;
create policy hidden_alerts_delete_admin on public.hidden_alerts
  for delete to authenticated using ((select private.is_admin()));
