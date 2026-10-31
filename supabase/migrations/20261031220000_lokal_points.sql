-- `lokal_points`: the places within a lokal (docs/design.md, "Platser på lokalen").
-- The club's old Lokalrapporter held these on Google My Maps: Röda ladan, where to
-- park, which dam the backsvala nests by. The app doesn't read this table.
--
-- One new table, owned by this repo. Nothing existing is touched: the trigger calls
-- private.touch_updated_at(), which this repo created, and the policies call
-- private.is_admin(), which they only execute.
-- Re-runnable: see .claude/skills/new-migration.


create table if not exists public.lokal_points (
  id bigint generated always as identity primary key,
  -- The lokal whose page lists this. No foreign key into public.locations, on
  -- purpose: it would put a constraint on the app's table and decide what happens
  -- when the app deletes a lokal. A row whose lokal is gone is simply never shown.
  location_id integer not null,
  -- The lokal this place has a page of its own as, if it does. No foreign key, as above.
  linked_location_id integer,
  -- 'practical' answers "how do I get there" and is read first; 'place' is a spot.
  kind text not null default 'place' check (kind in ('practical', 'place')),
  name text not null check (length(btrim(name)) > 0),
  note text not null default '',
  -- Both or neither: "Hitta hit" is practical and has no one position.
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lokal_points_both_coordinates check ((latitude is null) = (longitude is null)),
  constraint lokal_points_name_per_lokal unique (location_id, name)
);

comment on table public.lokal_points is
  'Places within a lokal, shown on its page at /lokaler. Owned by mafk-web; the app does not read it.';

-- location_id is covered by the unique constraint; this one serves "which lokal am I part of".
create index if not exists lokal_points_linked_location_id_idx
  on public.lokal_points (linked_location_id) where linked_location_id is not null;


drop trigger if exists lokal_points_touch_updated_at on public.lokal_points;
create trigger lokal_points_touch_updated_at
  before update on public.lokal_points
  for each row execute function private.touch_updated_at();


-- Privileges. The project's default privileges give anon and authenticated every
-- privilege on a new table, TRUNCATE included, which RLS does not cover.
revoke all on public.lokal_points from anon, authenticated;
grant select on public.lokal_points to anon;
grant select, insert, update, delete on public.lokal_points to authenticated;


alter table public.lokal_points enable row level security;
alter table public.lokal_points force row level security;

-- Everything here is printed on public pages, so there is no draft state to guard.
drop policy if exists lokal_points_select_anon on public.lokal_points;
create policy lokal_points_select_anon on public.lokal_points
  for select to anon using (true);
drop policy if exists lokal_points_select_authenticated on public.lokal_points;
create policy lokal_points_select_authenticated on public.lokal_points
  for select to authenticated using (true);

-- Writes: the administrator only.
drop policy if exists lokal_points_insert_admin on public.lokal_points;
create policy lokal_points_insert_admin on public.lokal_points
  for insert to authenticated with check ((select private.is_admin()));
drop policy if exists lokal_points_update_admin on public.lokal_points;
create policy lokal_points_update_admin on public.lokal_points
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists lokal_points_delete_admin on public.lokal_points;
create policy lokal_points_delete_admin on public.lokal_points
  for delete to authenticated using ((select private.is_admin()));
