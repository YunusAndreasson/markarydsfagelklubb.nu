-- Removes every dummy row that scripts/dummy-content.sql added (slugs
-- starting with `exempel-`). Run it before the WordPress import (step 8):
--
--   supabase db query --linked -f scripts/dummy-content-delete.sql
--
-- Images uploaded to dummy articles are not removed here: SQL can't delete the
-- files in the bucket. Delete them under /admin/bilder first, which removes
-- both the files and their rows.

begin;

delete from public.articles where slug like 'exempel-%';

-- Children before parents: pages refuse to be deleted while subpages exist.
delete from public.pages where slug like 'exempel-%' and parent_id is not null;
delete from public.pages where slug like 'exempel-%';

-- Articles in these categories are gone by now; anything else keeps existing
-- without a category.
delete from public.categories where slug like 'exempel-%';

commit;
