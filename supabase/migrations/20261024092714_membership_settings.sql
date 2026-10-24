-- The Klubben redesign: `membership_settings`, what joining the club costs and
-- how to pay (docs/design.md, "Klubben"; decided with the user 2026-10-24).
--
-- One new table, owned by this repo, holding a single row. The fees, the year
-- and the payment numbers used to be prose inside the Medlemskap page, so every
-- January someone had to find "2026" in a paragraph and the header button had
-- nothing to read. Now the join page, the Klubben page and anything else that
-- quotes a fee read the same row, and the admin edits it in one form.
--
-- Nothing existing is touched: the trigger calls private.touch_updated_at(),
-- created by this repo's content-core migration, and the policy calls
-- private.is_admin(), which it only executes.
-- Re-runnable: see .claude/skills/new-migration.


-- A single row, enforced by a primary key that can only be `true`. A settings
-- table with an id column invites a second row that some query then reads by
-- mistake; this one has nowhere to put it.
create table if not exists public.membership_settings (
  id boolean primary key default true check (id),

  -- The year the fees apply to. Membership is per calendar year (no autumn
  -- rule, decided 2026-10-24), so the page prints "Avgift 2027" from this.
  year integer not null check (year between 2000 and 2100),

  -- Whole kronor. Vuxen and ungdom each receive Cinclus; a familjemedlem lives
  -- with a full member and shares that household's copy.
  fee_adult integer not null check (fee_adult between 0 and 100000),
  fee_youth integer not null check (fee_youth between 0 and 100000),
  fee_family integer not null check (fee_family between 0 and 100000),
  -- "Ungdom t.o.m. 20 år": the last age that still counts as youth.
  youth_max_age integer not null check (youth_max_age between 1 and 99),

  -- Printed as given, so the admin decides the grouping ("123 267 61 61").
  -- The checks only keep out what could never be a Swish or bankgiro number.
  swish text not null default ''
    check (swish = '' or regexp_replace(swish, '[^0-9]', '', 'g') ~ '^[0-9]{10}$'),
  bankgiro text not null default ''
    check (bankgiro = '' or bankgiro ~ '^[0-9]{3,4}-[0-9]{4}$'),

  -- Who a new member sends their postal address to. Today the kassör's own
  -- address; a role address (kassor@…) replaces it once the domain's mail is
  -- set up, with no code change. These land in mailto: and tel: hrefs on a
  -- public page, so they get shape checks like pages.link_url does.
  contact_name text not null default '',
  contact_email text not null default ''
    check (contact_email = '' or contact_email ~ '^[^[:space:]@<>"]+@[^[:space:]@<>"]+\.[^[:space:]@<>"]+$'),
  contact_phone text not null default ''
    check (contact_phone = '' or contact_phone ~ '^\+?[0-9][0-9 -]{5,19}$'),

  updated_at timestamptz not null default now()
);

comment on table public.membership_settings is
  'What membership costs and how to pay: one row, read by /om-foreningen and the join page. Owned by mafk-web. Readable by anon, because it is printed on public pages; written only by the admin.';


drop trigger if exists membership_settings_touch_updated_at on public.membership_settings;
create trigger membership_settings_touch_updated_at
  before update on public.membership_settings
  for each row execute function private.touch_updated_at();


-- The row exists from the start, so the pages never have to handle "no
-- settings". Only the club's own facts are seeded here (they are on the
-- current site): the contact person is a private individual's details, so
-- they go in through the admin form rather than into a file in git.
insert into public.membership_settings (year, fee_adult, fee_youth, fee_family, youth_max_age, swish, bankgiro)
values (2026, 100, 40, 40, 20, '123 267 61 61', '5661-4969')
on conflict (id) do nothing;


-- Privileges. The project's default privileges give anon and authenticated
-- everything on a new table, TRUNCATE included, which RLS does not cover.
-- Anon reads; the admin updates the one row. Nobody inserts or deletes: the
-- row above is the only one there will ever be.
revoke all on public.membership_settings from anon, authenticated;
grant select on public.membership_settings to anon;
grant select, update on public.membership_settings to authenticated;


-- Row level security. Every column here is printed on a public page, so both
-- reads are unconditional; they are still two policies because they name two
-- roles. The write needs the admin.
alter table public.membership_settings enable row level security;
alter table public.membership_settings force row level security;

drop policy if exists membership_settings_select_anon on public.membership_settings;
create policy membership_settings_select_anon on public.membership_settings
  for select to anon using (true);
drop policy if exists membership_settings_select_authenticated on public.membership_settings;
create policy membership_settings_select_authenticated on public.membership_settings
  for select to authenticated using (true);

drop policy if exists membership_settings_update_admin on public.membership_settings;
create policy membership_settings_update_admin on public.membership_settings
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
