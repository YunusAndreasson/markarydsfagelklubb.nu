-- Step 8, the WordPress import: a public bucket for the documents the old
-- site links to (29 PDFs, most of them Cinclus, and 19 Word/Excel files).
--
-- Separate from site-media, which stays images only: its 5 MB, WebP/JPEG
-- limits are what keep an admin upload from being anything else. These are
-- copied byte for byte and stay public, as they are on WordPress today
-- (docs/roadmap.md, F2, "The 57 PDFs (Cinclus) stay public").
--
-- No policies: public URLs need none, and only the import writes here, with
-- the secret key. Uploading documents from /admin would be a later feature
-- with its own policies, scoped to bucket_id = 'site-files' like site-media's.
-- The upsert keeps the limits in step with this file on a re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-files',
  'site-files',
  true,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
