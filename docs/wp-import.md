# The WordPress import (step 8)

The build spec for `scripts/wp-import/`. **The decisions live in
`docs/roadmap.md` (F2, D3, D6, and the decision log); this file is how the
script implements them** and what still has to be worked out.

The import is a one-off. It runs **locally**, on a developer's machine, with the
Supabase secret key in an uncommitted env file — never in CI, never in the
Worker. It is idempotent, keyed on the WordPress post id, so it can be run
again after a fix without duplicating anything.

## Status, 2026-10-23

Built: the dry run and the real run for **posts** (`pnpm wp-import`, see the
header of `scripts/wp-import/index.ts`). The dry run over all 354 posts plans
449 body images (16 hotlinked) and 8 covers, maps every category, gives every
post a valid unique slug, loses no image to the sanitizer and leaves no link to
the old site. Its output is in `.wp-import/dry-run/` (gitignored).

Decided while building it (reversible, flagged to the user):

- **Captions become a paragraph under the image.** 113 posts have a
  `<figcaption>`, nearly all photo credits, and the editor has no caption node.
- **Only hand-written excerpts are kept** (3 of 354, read from the export). The
  automatic ones repeat the first paragraph, which the article page would then
  print twice.
- **A featured image is the cover only when the body doesn't show it** (8 of
  14). Otherwise the photo would appear twice.
- **Small originals render at their own size** (`content.css`): some are
  300 px wide and blurred when stretched to the column.
- **Re-runs are keyed on `articles.wp_id`** (migration
  `20261023174814_wp_import_ids.sql`, also `pages.wp_id`). Images get a storage
  prefix derived from their source URL (UUID v5), so a re-run finds them.

**All posts imported on 2026-10-23**: 353 of 354 articles, 401 images
(100 MB as WebP), 8 covers. Skipped: one image-only post (WP id 4479, an ad
with no title or text). Two untitled posts took their first bold line as
title. Eight images were dropped because their originals are gone (one 404 on
WordPress, seven on hotlink hosts). Galleries (6 posts) become a plain run of
images. The full report is `.wp-import/full-run.txt`.

**The pilot ran first, the same day**: the migration is applied, the dummy articles
and their categories are deleted (the dummy pages and events stay until real
ones replace them, since they are the whole menu and the whole kalender), and
the 10 newest posts are live with 24 images. A second run updated all 10 and
downloaded nothing. The key is passed as `--env .env --key-var sb`. Every
original the import downloads is kept in `.wp-import/originals/`, which is not
the full `wp-content/uploads` archive.

Not built yet: the **48 linked documents** (29 PDF, 19 Office) — `site-media`
accepts only WebP and JPEG up to 5 MB, so they need a bucket decision first;
the **pages**; and the Worker's **redirect map**, for which each run writes
`redirects.json`.

## Sources

Two, and each is better at something:

| | REST API | The WXR export |
|---|---|---|
| Published posts, pages, media | yes | yes |
| Drafts and private posts | **no** | yes (32 + 2) |
| Body HTML | `content.rendered` — **block comments already resolved** | raw `post_content`, with `<!-- wp:… -->` on 201 of 353 posts |
| The menu | no | 34 `nav_menu_item`s |
| The image files | no — public URLs | no — references only |

**Use the REST API for article bodies**, because rendered HTML is what a visitor
sees today and what we want to keep. Use the export for anything the API cannot
see, and keep it as the archive of the drafts we are dropping.

No credentials are needed: verified 2026-09-20 that `/wp-json/wp/v2/posts`,
`/pages`, `/media` and `/categories` all answer 200 anonymously, reporting 353,
39, 852 and 46.

**The host's firewall blocks bursts.** Measuring media sizes with ~830 HEAD
requests, 6 at a time, got the requesting IP blocked on 2026-09-19 while the
site stayed up for everyone else. **One request at a time, with a pause.** This
is not a tuning knob.

## The pilot, before anything else

Agreed 2026-09-20: **import the 10 most recent published posts first**, look at
them, and only then run the rest.

```
pnpm wp-import --limit 10 --dry-run     # writes nothing; prints what it would do
pnpm wp-import --limit 10               # the real thing
```

Then check in `pnpm preview`, **in Zen**: the article bodies, the images at
360 px and desktop, light and dark, and that no `markarydsfagelklubb.nu` URL
survives in a body. Ten articles is enough to catch a broken rewrite, a wrong
category and a mangled image, and small enough to delete and redo.

`--limit` takes the newest N by `published_at`. It stays in the script after the
pilot, because it is also how you re-run a slice after a fix.

## What it does, in order

1. **Categories.** Insert the six from F2's mapping table if absent. The
   45-to-6 mapping and the priority order (Tävlingar > Program > Mötesplats
   Ekebacken > Exkursioner > Referat > Föreningsaktuellt) are in the roadmap and
   belong in one exported constant here, not scattered.
2. **Posts.** For each, newest first:
   - skip anything not `publish`;
   - map the category, or leave `category_id` null for "Okategoriserade";
   - keep `published_at` and the author name as WordPress has them;
   - sanitize the body with **the site's own `src/lib/sanitize.ts`**, never a
     second allowlist — `editor-roundtrip.test.ts` exists to keep the sanitizer
     and the editor in step, and an import with its own rules would walk around
     that;
   - rewrite every `<img>` to the imported media (below);
   - upsert on the WordPress id.
3. **Media**, as each body needs it. See below.
4. **The redirect map** for old post URLs (`/<slug>/` → `/artiklar/<slug>`), and
   later the pages'. D6: the Worker serves it, `_redirects` never applies to
   Worker responses. A unit test covers it.

## Media

Downloaded to this machine, converted here, uploaded to `site-media`.

| Kind | What happens |
|---|---|
| Images (732 JPEG, 30 PNG/GIF) | `sharp` → **WebP, quality 82**, widths `[480, 960, 1600]` capped at the original, at `<prefix>/<width>.webp` |
| The 57 PDFs | copied byte-for-byte, public, never converted |
| A few Office files | skipped unless a body links to one |

**Quality 82 and those widths are not a new choice.** `src/lib/media.ts` defines
`IMAGE_WIDTHS` and `MediaFormat`, and the admin's browser uploader
(`src/components/admin/image-variants.ts`) already encodes WebP at 0.82. The
importer does in `sharp` what the browser does in a canvas, so an imported image
and one uploaded tomorrow are indistinguishable. **If you change one, change
both.**

- **"Unattached" does not mean unused.** WordPress records the post a file was
  *uploaded to*, not where it is used, so the 170 unattached files include ones
  referenced by URL inside other posts. The importer walks every body and takes
  what is actually referenced.
- **Hotlinked images** (`vinterfaglar.se`, `obj.fotosidan.se`, `tetrix.se`,
  `protelo.simpleit.nu`): fetch each; copy it in if it still answers, drop the
  `<img>` if it does not. Log both, per article.
- **Archive the originals first.** Re-encoding is one-way and WordPress is being
  switched off. The `wp-content/uploads` zip and the WXR export go somewhere
  offline **before** the import runs.

## Still open

- **The 39 published pages → the signed-off six-section tree.** The mapping is
  not written down yet. From the export, today's tree is:
  - **11 stubs with no content** (`/svalan/`, `/listor/`, `/program/`,
    `/klubbtavlingar/`, `/forsaljning/`, `/om-foreningen/` and the link-only
    children) — these become link entries or section pages, not imported prose.
  - **5 region pages** (Blekinge, Halland, Skåne, Småland, Öland), 181 b each,
    all Artportalen iframes → link entries under Obsar.
  - **Real content:** Länkar (4 612 b), Medlemsskap 2026, Verksamhet, Cinclus
    (`/om-foreningen/klubbbladet/`), Kontaktpersoner (`/kontakta-oss-2/`),
    Vinterfågelrally, Smålandsrallyt, Fågelholkar, Allmänt.
  - **Årsprogram 2026** (`/program/program-2013/`, 8 802 b) is **replaced by
    `/kalender`** (F3), so it redirects rather than imports.
  - **The 9 lokal pages under `/fagellokaler/` 301 to `/lokaler/<slug>`** (F5).
    Eight match a lokal — altaboke-sjo, hammarsjon, kophultssjon → `kophultasjon`,
    lokasjoomradet, ribersdal → `reningsdammarna`, skaraps-angar →
    `skararps-angar`, tannsjo → `tannsjoomradet`, angaback-och-skogon →
    `angaback`. **`tanneryd-damm` ("Tånnerydsdammen") matches none of the 61
    lokaler** and needs a decision: add the lokal in the app, redirect it
    somewhere else, or keep it as an ordinary page.
- **`/fagellokaler/` itself** → `/lokaler`, and `/svalan/` + `/listor/` →
  `/obsar`, `/medlemsskap/` → `/om-foreningen/medlemskap` (F1's sign-off).
