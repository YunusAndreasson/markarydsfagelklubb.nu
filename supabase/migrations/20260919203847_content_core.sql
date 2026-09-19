-- Step 3, content core: the site's own tables (categories, media, articles,
-- pages) and its public image bucket, `site-media`.
--
-- The database is shared with the live mafk-mobie app. Everything below is new
-- and owned by this repo; no existing object is altered. The storage policies
-- are new rows on storage.objects, and every one of them is scoped to
-- bucket_id = 'site-media', so the app's user_uploads_* policies are untouched.
-- Re-runnable: see .claude/skills/new-migration.


-- updated_at is set by the database, never trusted from the client.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Only triggers call it; EXECUTE is checked when a trigger is created, not
-- when it fires.
revoke execute on function private.touch_updated_at() from public, anon, authenticated;


-- Article categories. The WordPress import maps its 45 categories onto these
-- (docs/roadmap.md, F2).
create table if not exists public.categories (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- One row per uploaded image. The files live in the site-media bucket as
-- <storage_prefix>/<width>.<format>, one per entry in `widths`
-- (docs/roadmap.md, D3). No original filename is kept.
create table if not exists public.media (
  id bigint generated always as identity primary key,
  storage_prefix text not null unique
    check (storage_prefix ~ '^[0-9]{4}/[0-9]{2}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  format text not null check (format in ('webp', 'jpeg')),
  widths integer[] not null check (cardinality(widths) between 1 and 3 and 0 < all (widths)),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  alt text not null default '',
  bytes integer not null default 0 check (bytes >= 0),
  created_at timestamptz not null default now()
);

-- Articles (news, trip reports). A published article with a future
-- published_at is scheduled: nobody but the admin sees it until then.
create table if not exists public.articles (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) > 0),
  excerpt text not null default '',
  -- Sanitized by the Worker before it is written (src/lib/sanitize.ts).
  body_html text not null default '',
  cover_media_id bigint references public.media (id) on delete set null,
  category_id bigint references public.categories (id) on delete set null,
  author_name text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint articles_published_has_time check (status = 'draft' or published_at is not null)
);

-- The page tree. It drives both the URLs (pages keep their WordPress paths,
-- D6) and the menu (F1). A 'link' row is a menu entry that points elsewhere.
create table if not exists public.pages (
  id bigint generated always as identity primary key,
  parent_id bigint references public.pages (id) on delete restrict,
  kind text not null default 'page' check (kind in ('page', 'link')),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) > 0),
  -- The one value that lands in an href on every page. script-src allows
  -- 'unsafe-inline', so a javascript: URL here would run; only http(s),
  -- mailto and same-site paths (not protocol-relative //host) are accepted.
  link_url text,
  description text not null default '',
  body_html text not null default '',
  show_in_menu boolean not null default true,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pages_parent_slug_unique unique nulls not distinct (parent_id, slug),
  constraint pages_not_own_parent check (parent_id is distinct from id),
  constraint pages_link_url_shape check (
    (kind = 'page' and link_url is null)
    or (kind = 'link' and link_url ~ '^(https?://[^[:space:]]+|mailto:[^[:space:]]+|/([^/[:space:]][^[:space:]]*)?)$')
  ),
  constraint pages_published_has_time check (status = 'draft' or published_at is not null)
);


-- Indexes: every foreign key, and the columns the public queries and the
-- policies filter on.
create index if not exists articles_category_id_idx on public.articles (category_id);
create index if not exists articles_cover_media_id_idx on public.articles (cover_media_id);
create index if not exists articles_status_published_at_idx on public.articles (status, published_at desc);
create index if not exists pages_parent_id_sort_order_idx on public.pages (parent_id, sort_order);
create index if not exists pages_status_published_at_idx on public.pages (status, published_at);


drop trigger if exists articles_touch_updated_at on public.articles;
create trigger articles_touch_updated_at
  before update on public.articles
  for each row execute function private.touch_updated_at();

drop trigger if exists pages_touch_updated_at on public.pages;
create trigger pages_touch_updated_at
  before update on public.pages
  for each row execute function private.touch_updated_at();


-- Privileges. The project's default privileges give anon and authenticated
-- every privilege on new tables, TRUNCATE included, which RLS does not cover.
-- Start from nothing and grant back what the API needs: anon reads,
-- authenticated (in practice only the admin, per RLS) reads and writes.
revoke all on public.categories, public.media, public.articles, public.pages
  from anon, authenticated;
grant select on public.categories, public.media, public.articles, public.pages
  to anon;
grant select, insert, update, delete on public.categories, public.media, public.articles, public.pages
  to authenticated;


-- Row level security. One policy per command and role. Reads are split by
-- role because anon can't execute private.is_admin() (only authenticated
-- holds EXECUTE, and USAGE on schema private).
alter table public.categories enable row level security;
alter table public.categories force row level security;
alter table public.media enable row level security;
alter table public.media force row level security;
alter table public.articles enable row level security;
alter table public.articles force row level security;
alter table public.pages enable row level security;
alter table public.pages force row level security;

-- Categories are public.
drop policy if exists categories_select_anon on public.categories;
create policy categories_select_anon on public.categories
  for select to anon using (true);
drop policy if exists categories_select_authenticated on public.categories;
create policy categories_select_authenticated on public.categories
  for select to authenticated using (true);

-- Articles: the public sees what is published and due; the admin sees all.
drop policy if exists articles_select_anon on public.articles;
create policy articles_select_anon on public.articles
  for select to anon
  using (status = 'published' and published_at <= now());
drop policy if exists articles_select_authenticated on public.articles;
create policy articles_select_authenticated on public.articles
  for select to authenticated
  using ((status = 'published' and published_at <= now()) or (select private.is_admin()));

-- Pages: the same rule.
drop policy if exists pages_select_anon on public.pages;
create policy pages_select_anon on public.pages
  for select to anon
  using (status = 'published' and published_at <= now());
drop policy if exists pages_select_authenticated on public.pages;
create policy pages_select_authenticated on public.pages
  for select to authenticated
  using ((status = 'published' and published_at <= now()) or (select private.is_admin()));

-- Media: the public only sees the cover images of articles it can see. The
-- subquery runs under the articles policies, so the images of drafts and
-- scheduled articles stay private. Inline images need no row to render.
drop policy if exists media_select_anon on public.media;
create policy media_select_anon on public.media
  for select to anon
  using (exists (select 1 from public.articles a where a.cover_media_id = media.id));
drop policy if exists media_select_authenticated on public.media;
create policy media_select_authenticated on public.media
  for select to authenticated
  using (
    (select private.is_admin())
    or exists (select 1 from public.articles a where a.cover_media_id = media.id)
  );

-- Writes: the administrator only, on every table.
drop policy if exists categories_insert_admin on public.categories;
create policy categories_insert_admin on public.categories
  for insert to authenticated with check ((select private.is_admin()));
drop policy if exists categories_update_admin on public.categories;
create policy categories_update_admin on public.categories
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists categories_delete_admin on public.categories;
create policy categories_delete_admin on public.categories
  for delete to authenticated using ((select private.is_admin()));

drop policy if exists media_insert_admin on public.media;
create policy media_insert_admin on public.media
  for insert to authenticated with check ((select private.is_admin()));
drop policy if exists media_update_admin on public.media;
create policy media_update_admin on public.media
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists media_delete_admin on public.media;
create policy media_delete_admin on public.media
  for delete to authenticated using ((select private.is_admin()));

drop policy if exists articles_insert_admin on public.articles;
create policy articles_insert_admin on public.articles
  for insert to authenticated with check ((select private.is_admin()));
drop policy if exists articles_update_admin on public.articles;
create policy articles_update_admin on public.articles
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists articles_delete_admin on public.articles;
create policy articles_delete_admin on public.articles
  for delete to authenticated using ((select private.is_admin()));

drop policy if exists pages_insert_admin on public.pages;
create policy pages_insert_admin on public.pages
  for insert to authenticated with check ((select private.is_admin()));
drop policy if exists pages_update_admin on public.pages;
create policy pages_update_admin on public.pages
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists pages_delete_admin on public.pages;
create policy pages_delete_admin on public.pages
  for delete to authenticated using ((select private.is_admin()));


-- The public image bucket. Paths are never overwritten (a new upload gets a
-- new UUID prefix), so there is no update policy. The upsert keeps the limits
-- in step with this file on a re-run.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public URLs need no policy. The admin uploads and deletes from the browser;
-- delete also needs select, or remove() silently matches nothing (the app's
-- user_uploads_* policies pair them the same way).
drop policy if exists site_media_select_admin on storage.objects;
create policy site_media_select_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'site-media' and (select private.is_admin()));
drop policy if exists site_media_insert_admin on storage.objects;
create policy site_media_insert_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site-media' and (select private.is_admin()));
drop policy if exists site_media_delete_admin on storage.objects;
create policy site_media_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'site-media' and (select private.is_admin()));
