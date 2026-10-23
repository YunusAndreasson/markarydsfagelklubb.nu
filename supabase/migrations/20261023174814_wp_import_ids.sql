-- Step 8, the WordPress import: remember which WordPress post a row came from.
--
-- The import is idempotent, keyed on the WordPress id (docs/wp-import.md), so a
-- second run after a fix updates the rows the first one wrote instead of
-- adding copies. The slug can't be that key: the administrator may rename it
-- in /admin, and the next run would then insert the post again.
--
-- Only this repo's own tables change; nothing the app uses is touched. Null
-- for everything written in /admin. Re-runnable: see .claude/skills/new-migration.

alter table public.articles add column if not exists wp_id bigint;
alter table public.pages add column if not exists wp_id bigint;

-- A full (not partial) unique index, so PostgREST's `on_conflict=wp_id` can
-- use it. Nulls stay distinct, so any number of /admin-written rows fit.
create unique index if not exists articles_wp_id_key on public.articles (wp_id);
create unique index if not exists pages_wp_id_key on public.pages (wp_id);
