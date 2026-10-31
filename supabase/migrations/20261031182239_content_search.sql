-- Search over the articles and pages, for /sok (docs/design.md, "Sök"). The old
-- site had a search box; 353 articles need one. Only this repo's tables are
-- touched. The columns inherit each table's policies, so a search can only find
-- what the same visitor could already read, and a draft stays invisible.
--
-- A generated column keeps the index correct through every write path, the
-- admin and the WordPress import alike, without a trigger. Results sort by date,
-- as the lists do, so the terms carry no weights. Tags are cut out so "strong"
-- or an image's file name doesn't match.
-- Re-runnable: see .claude/skills/new-migration.

alter table public.articles
  add column if not exists search tsvector generated always as (
    to_tsvector(
      'swedish'::regconfig,
      title || ' ' || excerpt || ' ' || regexp_replace(body_html, '<[^>]+>', ' ', 'g')
    )
  ) stored;
create index if not exists articles_search_idx on public.articles using gin (search);

alter table public.pages
  add column if not exists search tsvector generated always as (
    to_tsvector(
      'swedish'::regconfig,
      title || ' ' || description || ' ' || regexp_replace(body_html, '<[^>]+>', ' ', 'g')
    )
  ) stored;
create index if not exists pages_search_idx on public.pages using gin (search);
