-- A line about each article category, shown as the ingress on its page
-- (/artiklar/kategori/<slug>) and edited at /admin/kategorier. Asked for on
-- 2026-11-18: a member found "Mötesplats Ekebacken" listed with nothing to
-- say what it is.
--
-- Plain text, like pages.description, with the same 300-character limit kept
-- by the form (src/lib/content-form.ts). Empty means no ingress. A constant
-- default makes this a catalogue change, with no rewrite of the table.
--
-- No grant or policy changes: categories is this repo's own table, its
-- grants are table-wide, and its select policies are row rules (everyone may
-- read every category), so the new column is covered as it stands.

alter table public.categories
  add column if not exists description text not null default '';
