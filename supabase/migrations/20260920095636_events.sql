-- Step 5, kalender: `events`, the club's program (docs/roadmap.md, F3).
--
-- One new table, owned by this repo. Nothing existing is touched: the trigger
-- below calls private.touch_updated_at(), which this repo created in the
-- content-core migration, and the policies call private.is_admin(), which they
-- only execute.
--
-- The publishing model is the articles one, column for column, so a draft and a
-- scheduled event behave exactly as a draft and a scheduled article do, and
-- src/lib/publish-state.ts works on both unchanged.
-- Re-runnable: see .claude/skills/new-migration.


-- One row per occurrence. Recurrence was considered and dropped (F3, decided
-- 2026-09-20): the admin copies an event for the next time, which costs one
-- form and saves expanding a rule in three views and in the iCal feed.
create table if not exists public.events (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) > 0),
  summary text not null default '',
  -- Sanitized by the Worker before it is written (src/lib/sanitize.ts).
  body_html text not null default '',

  -- An instant, always. `all_day` only says "print no clock"; the Worker has
  -- already moved such a start to midnight in Europe/Stockholm, so the day is
  -- unambiguous however the server is configured.
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,

  -- Free text ("Samling vid Ekebacken"), not a reference to public.locations:
  -- a foreign key into the live app's table would decide what happens when the
  -- app deletes a lokal. See .claude/rules/database.md, and the same reasoning
  -- in the hidden_alerts migration.
  place text not null default '',

  -- The list in src/lib/event-kind.ts. Kept here too so a value that reaches
  -- the table is always one the site can label.
  kind text not null default 'ovrigt'
    check (kind in ('exkursion', 'mote', 'resa', 'kurs', 'tavling', 'arbetsdag', 'ovrigt')),

  -- Lands in an href on a public page, so it gets the same shape check as
  -- pages.link_url: script-src allows 'unsafe-inline', and a javascript: URL
  -- here would run.
  registration_url text,

  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint events_published_has_time check (status = 'draft' or published_at is not null),
  constraint events_ends_after_starts check (ends_at is null or ends_at >= starts_at),
  constraint events_registration_url_shape check (
    registration_url is null
    or registration_url ~ '^(https?://[^[:space:]]+|mailto:[^[:space:]]+|/([^/[:space:]][^[:space:]]*)?)$'
  )
);

comment on table public.events is
  'The club programme shown at /kalender and published as /kalender.ics. Owned by mafk-web. Readable by anon once published, so the mobile app can show the same events later without a schema change.';


-- Indexes: the columns the select policies read (equality first, then the
-- range), and the one every public query sorts and filters on.
create index if not exists events_status_published_at_idx
  on public.events (status, published_at);
create index if not exists events_starts_at_idx on public.events (starts_at);


drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at
  before update on public.events
  for each row execute function private.touch_updated_at();


-- Privileges. The project's default privileges give anon and authenticated
-- every privilege on a new table, TRUNCATE included, which RLS does not cover.
-- Start from nothing and grant back what the API needs.
revoke all on public.events from anon, authenticated;
grant select on public.events to anon;
grant select, insert, update, delete on public.events to authenticated;


-- Row level security. One policy per command and role; reads are split because
-- anon can't execute private.is_admin() (only authenticated holds EXECUTE, and
-- USAGE on schema private).
alter table public.events enable row level security;
alter table public.events force row level security;

-- The public sees what is published and due; the admin sees all. Identical to
-- the articles rule, which is what lets a scheduled event stay invisible
-- without a single query repeating the condition.
drop policy if exists events_select_anon on public.events;
create policy events_select_anon on public.events
  for select to anon
  using (status = 'published' and published_at <= now());
drop policy if exists events_select_authenticated on public.events;
create policy events_select_authenticated on public.events
  for select to authenticated
  using ((status = 'published' and published_at <= now()) or (select private.is_admin()));

-- Writes: the administrator only.
drop policy if exists events_insert_admin on public.events;
create policy events_insert_admin on public.events
  for insert to authenticated with check ((select private.is_admin()));
drop policy if exists events_update_admin on public.events;
create policy events_update_admin on public.events
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists events_delete_admin on public.events;
create policy events_delete_admin on public.events
  for delete to authenticated using ((select private.is_admin()));
