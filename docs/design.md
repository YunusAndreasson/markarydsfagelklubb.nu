# Design: the public site

**Read [Dagslistan](#dagslistan-2026-10-31) first, with its "Larmbandet" correction.**
It is the newest pass and overrides what it names below: the typeface, the tinted
neutrals and the header.

The design plan for mafk-web's public pages, written in step 3 with the
`frontend-design` process: plan, review against the brief, build, critique.
The admin area uses shadcn defaults and isn't covered here.

## Brief

- **Subject:** Markaryds Fågelklubb, the bird club of Markaryds kommun in
  southwest Småland. Its WordPress tagline says it plainly: *"Om fågelskådning
  och naturliv i Markaryds kommun."*
- **Audience, in order:**
  1. members coming back to see what's new, on phones as often as desktops;
  2. locals curious about birds or the club.
- **Job:** show what's happening in the club. That's the latest articles today;
  larm (step 4) and the program (step 5) join the home page as they land.
- **Fixed:** Markaryd green and the neutral tokens, which the live app shares,
  and **Inter only** (decided 2026-09-19).

## What the club's world gives us

Everything the club publishes is anchored by **when and where**:

- the program: *"Lördag 21 februari – Ugglespaning"*;
- trip reports (*Referat*): *"Sträckräkning, Skararps ängar"*;
- the lokaler: Hammarsjön, Köphultasjö, Ekebacken.

A birder's field notebook works the same way: each entry is dated in the
margin, with the place first and then what was seen. The club's photographs are
members' own, of birds in the kommun. Species are written as a Swedish name,
sometimes with the scientific name, which is italic by convention.

## Dagslistan (2026-10-31)

The third pass, asked for as "significantly improve this website", with free
hands, validated against the WordPress site. Two things were wrong: the site
could have belonged to any association (white, Inter, grey small print, where the
old site at least had the dipper by the stream), and it answered "what is
happening now?" badly. On the Saturday of Smålandsrallyt a 13-day-old article led
and the larm rail had vanished.

**The one memorable thing:** the home page opens with the day's species as a run
of text on a spruce band, the way a birder writes up a day. Each name links to its
larm and the notable ones are yellow (`Dagslistan.astro`, `buildDayList` in
`front-page.ts`). Everything else stays quiet. A big "40 arter" with a small label
was considered and rejected: the names are the content. The sentence says
"larmat" because the count doesn't include Artportalen. The newest article still
leads under it (the 2026-10-28 decision stands).

- **Type:** Alegreya (variable, self-hosted, Latin subset 43 KB) for headings,
  titles and species, with its italic for scientific names; bookish and alive, and
  its numerals are set lining. **Inter stays** for running text, dates and
  controls, which keeps the site beside the app. Alegreya's small x-height is why
  `type-item` is 21 px against Inter's 18.
- **Colour:** Markaryd green is unchanged and shared with the app. New: **Gran**
  `#14302A` (the band, the footer), **Reflex** `#F2C230` (the yellow in the stream
  under the old site's dipper; status on Gran only, 8.4:1, never text on white),
  **Is** `#EEF3F1` (replaces neutral grey), **Bläck** `#17201D`, **Blyerts**
  `#53605B` (6.6:1 on white, 5.9:1 on Is). `surface-gran` remaps the tokens on a
  dark band, so children keep their semantic classes.
- **Header:** 72 px instead of 128; the tagline moved to the footer, and "Sök" joined
  the menu. The band sits inside `main`, so the skip link lands on it.

**What else changed, each for a reason seen on the page:**

- **Larm sort on `observed_at`**, the time they print. On `sent_at` the log read
  14:33, 08:30, 13:30. `/larm` groups by day under "I dag", "I går", "Fredag 30
  oktober", with only the clock in the margin.
- **The rail reaches back past photo-less larm** (the home page reads 200, not 12),
  so it no longer vanishes on the busiest days. An article repeating the lead's photo
  loses it (`withoutPhoto`).
- **Program:** the date is in ink, the one list where it is what you scan for, with
  "I dag" or "Pågår" under it (`event-status.ts`). `contact_name`, `contact_phone`
  and `signup_deadline` carry what the club's sign-ups always were, a person, a number and
  a last day. A closed sign-up drops "Anmäl dig". A multi-day event stays in the
  programme through its last day.
- **Sök** (`/sok`, plain GET form, no script): a generated `tsvector` on `articles`
  and `pages`, or the query anywhere in the title, since the Swedish stemmer can't
  find "uggla" in "sparvuggla" (`lib/search.ts`). Lokaler match by name in memory.
  Lokaler and pages first, because they are few and someone typing them wants that
  page.
- **Arkiv** (`/artiklar/ar/<år>`), the year strip at the foot of `/artiklar`; old
  `/2024/05/` URLs 301 there.
- **Obsar** has its own route: **Rapportera** first as the page's one band, then the
  kommun's links with a line each, then the neighbouring landskap as plain links
  (`lib/obsar.ts`).
- **Lokaler:** "Larmat senaste två veckorna" first, then the register in columns, about
  a thousand pixels shorter. An active pin is larger as well as green, the icon's hit
  area is 24 px, and Leaflet's links are out of the tab order inside the `aria-hidden` map.
- **Articles:** a cover takes the margin's width too. Two or more photos in a row become
  a two-column sheet at render (`withGalleries`), whole rather than cropped; the
  stored body and the editor are untouched.
- **Klubben** opens with the dipper, Lars-Erik Andréasson's photo from the article
  "Strömstarens ankomst", credited under it.
- **Errors:** a failed read answers 500, which Astro serves as the prerendered
  `500.astro` with the site's header, instead of a line of plain text. The 404 has a
  search box. Reading "503" in old notes: public pages don't send it any more.

**Larmbandet, the correction (same evening).** Running every species name at display
size was the wrong call, and the user caught it twice: "alldeles för många larm", "nu
har vi det dubbelt". Forty names are noise, they filled the first screen, the programme
appeared twice, and six yellow links competed. The band is now one sentence ("40 arter
larmade i dag, bland dem mandarinand."), one "Alla larm" and five photos with species
and time (`LarmBand.astro`). It is the page's **only** block of larm. Every species
stays on `/larm`, and today's event is marked in "Närmast i programmet", not repeated.
The lead photo went to 3:1 so its headline reaches the first screen at 1280×900.

**The lead shows the article's own opening** (the user: the first page looked empty when
there was more to show). Whole paragraphs up to about 600 characters, links kept
(`leadOpening`), so a short report reads in full on the home page. "Läs hela artikeln"
appears only when there is more: this reverses "no Läs mer" for that one case, because a
headline alone doesn't say the text stopped.

**It has to hold on a quiet day too** (the user's note: some days there will be one larm
or very few). Up to three species the sentence names them all ("I dag har medlemmarna
larmat kungsfiskare."), because "1 art" says less than the bird's name. With nothing
today it says when the last one was ("Senast larmat i går: …", "Senast larmat 3 juli:
…") and never claims there were none, since "Övrigt (ej fågel)" isn't counted. Photos
older than a month stay off the band (`latestPrints`): a dated bird from months back
makes the page look abandoned. One or two prints stand beside the sentence; none, and the
band is the sentence alone, 108 px. With no larm at all there is no band.
 Where
this section's opening paragraphs describe the run of names, this replaces them.

**Hämta appen** (same evening, the user's call, reversing "not the stores' badges"
under Larm): the stores' official Swedish badges, 40 px tall and unaltered
(`AppLinks.astro`). In the footer of every page, in the rail beside the home page's
lead, and under the intro on `/larm`. Not in the band, which is about the birds.

**The hierarchy, reviewed page by page (same evening).** Each page has one reading order:

1. **Peak:** the band on the home page, then the lead. The lead's display size came down
   from 76 to 60 px and the page title from 54 to 48, because two things can't both be
   the loudest.
2. **Section:** `type-section`, 28 px. **Its heading starts where its content starts:** at
   the container's edge over full-width tiles or prints, at the 7rem column over text.
3. **Entry:** `type-item`, 21 px Alegreya. **Fact:** 16 px Inter. **Meta:** 14 px Inter.
4. **Utility beside the lead:** the programme and the store badges share the rail, in
   body-size type under meta labels. They used to float alone in the page's own flow,
   where black badges outweighed the article above them.

Also: a `crumb`'s 44 px target no longer pushes its line apart; "I dag" and "Pågår" look
the same wherever they appear; prices are Inter, since tabular figures turned Alegreya's
old-style; neighbours in a list don't repeat a photo; every search field is the same field.

**Last pass, on the phone pages (same evening).** A lokal shows its newest six larm and
folds the rest (`LarmFold.astro`, shared with `/larm`), since Reningsdammarna ran to 5,700
px; "På lokalen" is still whole, one tap away. "I närheten" is one line per larm. The full
register drops its tallies on a phone. Phone numbers in stored bodies become `tel:` links
at render (`linkPhones`), because the club's sign-ups run on them. Tiles never repeat a
photo, or show the article's own. Filled buttons and search fields get the same 2 px focus
outline as links (`focus-strong`).

**Platser på lokalen (same evening).** The old Lokalrapporter's Google My Maps became the
site's own data: 51 places on eight lokaler in `lokal_points`, a table the app doesn't read,
edited at `/admin/lokalplatser`. Not embedded: Google's frame would load a third party on
each visit, trap scrolling on a phone, and hide the tips inside a popup. The hierarchy is
**Fågellokaler → lokal → plats**, with no third kind of page. A lokal page reads: where it
is (map with numbered pins), "Bra att veta" (how to get there, where to park, where we
meet), "Platser på lokalen", then larm. The number sits in the margin, as dates and letters
do, and is the same mark as the pin, since a phone has no hover. A place that is a lokal
itself links there, and that lokal gets the parent in its breadcrumb and the club's note as
its ingress. What this costs is Google's satellite view. The Lokasjöområdet map no longer
exports (404), so that lokal has no places. Tånnerydsdammen is not one of the app's lokaler,
so its places are on Jacobssons udde.

**Stora dagar** (same day, the user's note: "alldeles för många larm"). On a rally day
the log ran to four pages and the band pushed the lead down. A busy day now
discloses in steps, with no script, and an ordinary day looks as before:

1. **Home:** Larmbandet above, whose size doesn't change with the day. The rail reaches
   back past photo-less larm (`latestPrints`), and the sentence names the notable birds
   so a photo-less rarity isn't hidden.
2. **`/larm`, a day:** up to eight larm show in full. Above that, six stay: notable
   birds, then photos, then the newest, in the log's order, under a line such as "48
   larm om 40 arter". The rest fold into one-line rows, each marked "Foto" if it has one
   (`digestDay`).
3. **`/larm`, paging** is by whole days, at most four (`pageOfDays`), so a summary
   never covers half a day.

**Rejected on review:** cream and terracotta (the common default; the site keeps
white and the cool tones of water), and any motion on load. A dark band with one
bright accent is close to another default, so Gran is plainly green and the yellow
only ever means status.

## Direction: *fältdagboken*

The site reads as the club's shared field notebook.

- **Dates live in a margin.** On lists and articles, the date sits in its own
  narrow column to the left of the text. It's the first thing a member scans
  for, so the layout itself carries it: tabular numerals, the weekday in full
  where it matters ("lördag 19 september"), as the club writes it.
- **One bold thing:** the lead story on the home page. The newest article is set
  at display size in Inter's display cut, with its photo full-bleed on a phone.
  ~~Everything after it is quiet.~~ Since 2026-10-24 the members' photos carry
  the rest of the page too; see [Tidskriften](#tidskriften-2026-10-24).
- **Quiet everywhere else:** one left-aligned reading column, no cards, no
  decoration, and colour only where something can be clicked. (Still true of
  cards, decoration and colour; the home page and the lists now use the full
  container for photos.)
- **Photos are the members' own work,** shown large, uncropped where the
  layout allows (never a forced square), and always with alt text.

## Tidskriften (2026-10-24)

The second pass, asked for as "more like a magazine, with better use of images
for articles and alerts, so the page feels alive". Benchmarked against Audubon,
National Geographic, Monocle and BirdLife Sverige (fetched), and The Atlantic
and NYT Magazine (from their known layouts).

### What changed in the brief

The notebook direction was written when the import was expected to bring almost
no photos, so a typographic page was right for the data. The data turned out
otherwise:

- **Articles:** 8 of 353 have a cover, but **222 carry photos in the body** —
  71% of the past year's posts. Every photo-less post of the past two years is
  a short notice (110–710 characters).
- **Larm:** 64% have a photo, 77% in the past month.

The site was hiding them. The spine stays — the date margin, Inter only, green
only for action, no cards, no all-caps, no middle-dot strings — and "quiet
everywhere" becomes **"the members' photos carry the page"**.

### Principles

1. **Anything with a photo shows it**, at the ratio its role uses.
2. **The date margin stays the spine**, on the lead and in every list.
3. **Size makes the hierarchy:** a 2:1 lead, then 3:2 for everything else, at
   the size its role gives it: tiles, prints, thumbnails. No kicker labels
   beyond the lead's category. (The larm prints were 4:5 until 2026-10-24; see
   the rail below.)
4. **No placeholders.** A story without a photo is type, never a grey box. That
   is honest because those stories are notices.
5. **No text over photos**, no gradient scrims, no carousels, no hover zoom.

### Where an article's photo and opening line come from

`src/lib/teaser.ts`, read from the stored, sanitized body, so the article page
and the import are untouched:

- **Photo:** the cover if the editor set one; otherwise the first of the body's
  opening six photos that is landscape (w/h ≥ 1.2) and at least 960 px wide;
  otherwise the first at least 480 px wide; otherwise none.
- **Opening line:** the hand-written excerpt; otherwise the first paragraph
  that isn't empty, doesn't hold an image, isn't the caption the import wrote
  after one, isn't a photo credit and doesn't merely repeat the title. Cut at a
  word with "…". On the newest 40 posts this gave 40 opening lines and no photo
  credit.

### Home

```
desktop (lg)                                          360 px
[ lead photo, 2:1, 64rem ]                            [ lead photo 3:2, full-bleed ]
onsdag      Inför Smålandsrallyt        Närmast i     onsdag 30 september  Tävlingar
30 sep.     opening line …              programmet    Inför Smålandsrallyt  ← display
Tävlingar                               (≤ 3 events)  opening line …
                                        Hela progr.   Närmast i programmet (≤ 3)

Senaste larmen                          Alla larm     Senaste larmen       Alla larm
[3:2][3:2][3:2][3:2][3:2]                             [3:2 ][3:2   → swipe
Järnsparv / Nära Klintbadet / i går 08:25
        Övriga larm
22 okt. 12:46  Kungsfiskare  Reningsdammarna  Åsa Andersen   ← one line each

Fler artiklar                       Alla artiklar
[3:2]       [3:2]       [3:2]                         tiles stacked full width
18 okt. Tävlingar / title / opening line
30 sep.     Medlemsmöte …                             the dated list,
 6 sep.     Nu finns …                                thumbnail on the right
18 juni     upprop 2026!                 [3:2]
```

- ~~**The lead** is the newest of the latest four articles with a hero-worthy
  photo, so the page opens on a picture rather than on "programändring!" at
  72 px.~~ Reversed 2026-10-28: it put "Inför Smålandsrallyt" (30 Sep, wide
  photo) above "Programändring!" (18 Oct), the post that moved its date, and
  the page read as out of date. **The newest article always leads**
  (`pickLead` in `src/lib/front-page.ts`). It gets the photo only when its
  first one is hero-worthy; otherwise it leads as plain type. The photo is
  cropped to 2:1 from `md` up (3:2 on a phone) so the headline stays above the
  fold at 1280×900.
- **"Närmast i programmet"** takes the column beside the headline from `lg` up.
  At `md` the container is only 45rem, so it sits under the lead there.
- **The larm rail** is the page's live part: the five newest larm with a photo,
  as 3:2 prints with the species, place and "i dag" / "i går" / date under each
  (`dayLabel`). They were 4:5 at first, to make the bird larger, but the
  members' photos are camera frames of about 3:2, so a portrait print kept half
  the width and cut off heads and tails (changed 2026-10-24 at the user's
  request). Below `lg` it scrolls sideways inside itself, snapping print by
  print, with no script. **"Övriga larm"** lists every photo-less larm newer
  than the last print, uncapped, so a rare bird reported without a picture is
  never hidden behind older photos (`splitLarm`). It is one line per larm,
  because full notebook rows under the rail outweighed the photos.
- **"Fler artiklar"**: the next three articles with a photo as tiles, with no
  card chrome and never a second row, then the rest as the dated list.
- Section headings are 1.5rem (`type-section`) with the one "Alla …" link on the
  same line, at the container's edge. Sections are still separated by space,
  not rules.

### Lists and related blocks

- **The article list** (`/artiklar`, categories, the home page) puts each
  article's photo on the right as a 3:2 print, aligned to the container's
  edge. A row without one simply has none.
- **`/larm`** shows the photos in a right-hand column (18rem, 3:2) from `md` up,
  so they line up like a contact strip and the log is half as long; on a phone
  they stay full width under the row.
- **"Mer i <kategori>"** under an article: the newest three in the category with
  a photo, as tiles; if none has one, the old list.
- **"Fler larm"** under a larm: the newest three with a photo, as a rail of
  prints, in the reading column's width.

### Photo sizes

Larm photos are members' full-size originals, so the route asks Storage for
fixed sizes (`src/lib/alert-photo.ts`; roadmap decision log, 2026-10-24):
480/960/1600 wide in the photo's own shape. The feed and the rail share the
480/960 files and crop them to 3:2 in CSS; a larm's page shows 960/1600 whole.
(The rail's Storage-cropped 4:5 sizes, `p480`/`p960`, went with the 4:5 prints.) Measured on the preview,
`/larm` went from 3.9 MB to 0.34 MB, and the home page shows 12 photos instead
of 2 in less weight than before (520–625 KB against 685 KB).

### Left for a later pass

- The article page itself: a wide hero photo (the cover, or the body's first
  photo moved up) and real `<figure>`/`<figcaption>` captions. Captions are
  paragraphs today, so this needs a caption node in the editor and sanitizer
  and a re-import.
- Imported titles in lowercase or capitals ("programändring!", "EKEBACKEN 28
  APRIL") are for the editor to fix, not CSS.

## Polish pass (2026-10-24)

Every main page screenshotted at 360 and 1280 px (Gecko), reviewed, fixed and
shot again; the event page checked in Zen. Besides the footer, the article grid
and the section lists above:

- **Pages that can't read the menu still have one.** The prerendered 404 and
  legal pages, and any page whose navigation query fails, show
  `FALLBACK_MENU` (`src/lib/page-tree.ts`), the tree's six top-level sections.
  On a phone they had no "Meny" at all.
- **Events:** the time is a range, "18:30–21:00", on the start's day; "till …"
  only when it runs past the day. "Hela programmet" closes the page.
- **Article categories on a phone** are one row that scrolls sideways; wrapped,
  they took three rows of 44 px targets above the first article.
- **Every page intro is the grey ingress.** Larm and Lokaler had theirs in ink.
- **Icons:** the club's emblem is the favicon (64 px) and the home-screen icon
  (180 px, on white because iOS fills transparency with black), both imported
  so they get `/_astro/` names. The green SVG favicon read as a tick at tab size
  and is gone, with its `run_worker_first` exclusion.
- **Link previews:** Open Graph and Twitter-card tags in `base.astro`; the home
  page, articles and larm pass a photo. A larm's description says "nära
  Klintbadet", not "vid Nära Klintbadet".

## Ordval (2026-10-24)

The copy was benchmarked against how Swedish bird clubs actually write:
BirdLife Sverige (birdlife.se), Skånes Ornitologiska Förening (skof.se),
BirdLife Västmanland (vof.birdlife.se and its printed autumn programme) and
BirdLife Östra Småland (osof.se). The brief was copy that reads less generated.

**The clubs' vocabulary, which the site follows:** *Bli medlem*, *Program*,
*exkursion*, *innemöte*, *samling* ("Samling: 18:00 vid …"), *samåka*, *fika*,
*Fågellokaler* (SkOF, BirdLife Västmanland), *Aktuella obsar* (SkOF), *Rapportera
fåglar*, *prenumerera på programmet* (BirdLife Västmanland: "Vill du få VOF:s
program i din kalender kan du prenumerera på det"), *Ändringar i programmet kan
tillkomma*.

**What read as generated, and what replaced it:**

| Before | After | Why |
|---|---|---|
| Lokaler (heading), "Klubbens lokaler" | Fågellokaler | "lokaler" alone is also the club's premises; the clubs write *fågellokaler* |
| "Platsen visas ungefärligt, som närmaste lokal." | "Platsen anges ungefärligt, med närmaste fågellokal." | the old clause didn't parse |
| "Med klubbens app larmar du själv och får larmen som notiser i mobilen." | "Ladda ner klubbens app, så kan du själv larma och få larmen direkt i mobilen." | a plain instruction, not a feature list |
| "… och nya datum kommer med av sig själva." | "… och ändringar kommer med automatiskt." | personified dates |
| Också larmat | Övriga larm | |
| I det här avsnittet | Här hittar du | a translation of "In this section" |
| "så att Cinclus hittar fram" | "så att Cinclus kommer fram" | the post *kommer fram* |
| "Klart! Programmet och Cinclus kommer …" | "Sedan är du medlem. Cinclus med årets program kommer i brevlådan …" | |
| "… kunde inte läsas just nu" | "… kunde inte hämtas just nu" | "could not be read" |
| Till innehållet | Gå direkt till innehållet | the standard Swedish skip link |

**Rules of thumb:** name things the way a member says them, not by what they
do ("Övriga larm", not a description); no exclamation marks in running text;
no personified objects (dates that arrive, magazines that find their way);
don't promise members something the programme gives everyone (excursions are
open to all, so membership is Cinclus and supporting the club, not access).

The Klubben page's own membership paragraph (code, not `pages`) had the same
promise; it now reads "Som medlem får du programbladet Cinclus och stöttar
klubbens fågelskydd".

Not changed, as the user's to decide: the menu's *Artiklar* (every benchmark
says *Nyheter*) and *Lokaler* (*Fågellokaler*), which live in the page tree,
and Klubben's body copy, which lives in `pages`.

## Hierarki (2026-10-24)

A review of type, visual hierarchy and semantic colour across the public
pages, at 360 and 1280 px in Gecko and in Zen. Every type size on the public
site now comes from a named role (see "Type"); the ad-hoc `text-lg
font-semibold` and `text-xl` titles are gone.

**Found and fixed:**

- **Headings the size of what they head.** The programme's month headings and
  the lokal page's "På lokalen" / "I närheten" were 18 px semibold, the same as
  the entries under them. They are `type-section` now.
- **Four sizes within 2 px** for titles (18, 20) and leads (18, 19). Article
  tiles were 20 px and the rows under them 18 px, in the same section; all
  entries are `type-item` (18 px), so "Fler artiklar" clearly outranks them.
- **The larm page stacked four grey styles** under the place (italic 16,
  meta 14/500, body 16, then a margin). The scientific name now sits under the
  species, as in a field guide; under the place, one meta line holds the
  rarity and the observer.
- **The event page put the ingress below the place**, a 19 px grey line under
  an 18 px one. The summary is the ingress, under the title; the place sits
  level with the date, as on a larm.
- **The larm rail mixed two 14 px weights** (place 400, time 500); both are
  `type-meta`.
- **Green links gave no hover feedback** unless they were in body text. The
  `link` utility gives every green link the body's 2 px hover underline.
- **The phone menu marked the current page in green**, which elsewhere means
  "action"; it now has the desktop menu's ink and green underline.
- **Blyerts** went from 6.0:1 to 7.1:1 (see "Colour").

~~**Left open:** photo captions are paragraphs at body size.~~ Done the same
day: the editor has a figure node, and the stored articles' captions went back
into figures (see "Rendered content" and docs/wp-import.md, "Tidying").

## Tokens

### Colour: light only

The site has one theme, light, since 2026-10-24 (the user's call: simpler, and
done properly). The dark theme, its tokens and the script that switched to it
are gone.

| Name | Value | Contrast on Papper | Use |
|---|---|---|---|
| Papper (background) | `#FFFFFF` | | page |
| Bläck (foreground) | `#0A0A0A` | 19.8:1 | text |
| Markarydsgrön (primary) | `#137D41` | 5.2:1; white on it 5.0:1 | links, the one button, focus |
| Blyerts (muted-foreground) | `#585858` | 7.1:1 (AAA), APCA Lc 85; 6.5:1 on `muted` | dates, ingress, excerpts, meta |
| Larmrött (rarity) | `#C42A20` | 5.7:1 | the two rarest levels |
| Linje (border) | `#E5E5E5` | 1.3:1 | the header rule, tables (decoration) |

- **Blyerts differs from the app.** It was the app's `#737373`: 4.7:1 on
  white passes AA, but the public site sets places, observers and dates in it
  at 14 px, and it failed AA on the `muted` grey (4.3:1). It went to `#636363`
  (6.0:1), then to `#585858` in the hierarchy pass: ingresses and excerpts are
  read, not glanced at, so all text on the page now meets AAA. It stays well
  clear of Bläck, so grey still means "secondary". Green, Inter and everything
  else stay shared.
- **Open, admin only:** the admin's fields are shadcn `base-luma` pills, filled
  with `--input` at 50% (`#F2F2F2`) and no border, so their edge is about
  1.1:1 against the card; WCAG 1.4.11 asks 3:1. Darkening the fill only made
  heavy grey bars. The fix is outlined fields, an edit to the generated
  `input`, `textarea` and `native-select`. The public site has no fields.
- **Focus:** a 2 px `--ring` outline, offset 2 px, on anything without its own
  focus style. The inherited outline was the ring at 50%, 2.1:1.
- **Light only, enforced:** `color-scheme: only light` (meta and CSS), which
  also keeps Chrome on Android from darkening the page itself; `theme-color`
  white, so a phone's toolbar meets the header. The `dark` variant is kept but
  never matches, so the `dark:` classes in the generated shadcn components stay
  off.

Colour stays reserved for action and status, as in the app. Nothing on the
public site is green unless it is a link or a control.

- **Links, three kinds, one meaning each.** A standalone action or a link in
  a sentence is green and underlined (`link` in `global.css`, 2 px on hover,
  like `.content a`). A title that links stays ink, with a green underline on
  hover. Navigation is Blyerts, and the current page is ink with a 2 px green
  underline, on the desktop menu, the phone menu and the category tabs alike.
- **Status:** Larmrött marks the two rarest levels, always beside the label
  ("Sällsynt"), never colour alone. A green map pin marks a lokal with larm in
  the last fortnight; the pins are controls, and the ingress says what green
  means.

### Type: Inter with its optical-size axis

`@fontsource-variable/inter/opsz.css` replaces the plain variable file: +25 KB
for the Latin subset, which covers å, ä and ö. With `font-optical-sizing: auto`,
text from 32 px up gets the display cut on its own: tighter spacing and crisper
joins. The scale roughly follows a classic progression (16 · 18 · 21 · 24 · 32 ·
48 · 72).

| Role | Size (mobile → desktop) | Weight | Tracking | Leading |
|---|---|---|---|---|
| Display (lead story) | `clamp(2.5rem, 1.3rem + 5.2vw, 4.5rem)` | 700 | −0.035em | 1.02 |
| H1 (article, page) | `clamp(2rem, 1.5rem + 2.4vw, 3rem)` | 650 | −0.025em | 1.08 |
| H2 (`type-section`) | 1.5rem | 600 | −0.015em | 1.2 |
| H3 | 1.25rem | 600 | −0.01em | 1.3 |
| H4 | 1.0625rem | 600 | 0 | 1.4 |
| Entry title (`type-item`) | 1.125rem | 600 | −0.01em | 1.35 |
| Fact line (place on a larm or event) | 1.125rem | 500 | 0 | 1.55 |
| Ingress | 1.1875rem | 400, muted | 0 | 1.5 |
| Body | 1rem → 1.0625rem | 400 | 0 | 1.65 |
| Meta / dates | 0.875rem, `tabular-nums` | 500 | 0 | 1.4 |

- The reading measure is at most **38rem** (about 68 characters).
- **Every list uses `type-item`** for its entries' titles: articles (tiles and
  rows alike), larm, events, lokaler, a page's subpages, the fee table. A
  heading over a list is always `type-section`, so it outranks its entries
  by at least 1.33×; the month headings in the programme and "På lokalen" /
  "I närheten" were the size of their own entries until 2026-10-24.
- No all-caps anywhere. Labels are sentence case.

### Space and shape

- A 4 px base. Sections are separated by **space**, not rules: 3rem on mobile,
  4.5rem on desktop.
- There's one rule on the whole page, under the header.
- Radius by role, not one radius for everything:
  - photos 4 px, so they read as prints;
  - the button uses the token radius;
  - the mobile menu panel has none.

## Layout

The page is one left-aligned column (38rem) with a **margin column** (7rem) on
the left from 768 px up. The header and footer span a 64rem container.

### Header

```
desktop ≥ 768 px
( ◉ ) Markaryds Fågelklubb          Artiklar  Larm  Program  Obsar  Lokaler  Klubben  [Bli medlem]
      Fågelskådning och naturliv
      i Markaryds kommun
────────────────────────────────────────────────────────────────────────────────────

360 px
( ◉ ) Markaryds Fågelklubb              [ Meny ]
────────────────────────────────────────────────
```

- **The club's emblem** (the dipper and "1986", added 2026-10-24) stands left of
  the wordmark, as tall as the name and tagline together: 44 px on a phone, to
  match "Meny", 48 at `md`, 64 at `lg`. On a phone the name wraps to two lines
  beside it, "Markaryds" over "Fågelklubb", as the emblem itself sets them. From
  `lg` the tagline is two lines, broken after "naturliv": on one line, beside
  the emblem, it pushed "Klubben" under the menu. It is the app's own artwork
  (`splash-icon.png`), a white disc in a black ring; it is not redrawn or
  recoloured. It links home but is hidden from
  assistive tech and the tab order, since the name beside it is the same link.
- The club's name is a wordmark in Inter at 600 weight, linking home. The
  tagline shows from 1024 px up (`lg`; it was 768 until 2026-10-24, where it
  widened the wordmark's column enough to wrap "Klubben" onto a second line).
- **No dropdowns.** A top-level item links to its section page, and that page
  lists the section's pages. It's simple, accessible, and needs no JS.
- **Mobile menu:** a `<details>` disclosure labelled "Meny", which opens the
  whole tree, children indented. No JS, and it works in every browser the club
  uses.
- The current section is marked with `aria-current` and underlined in green.

### Sponsorer (2026-10-24)

The WordPress site showed four sponsors in its left rail, under "Sponsrad av:".
The brief: on the first screen, but not overly exposed.

```
desktop ≥ 768 px
( ◉ ) Markaryds Fågelklubb          Artiklar  Larm  Program …  [Bli medlem]
────────────────────────────────────────────────────────────────────────────
                     Sponsrad av   Sparbank   Balkheds   Gränsbygden   Derome
[ lead photo, 2:1                                                          ]

360 px, after the lead and "Närmast i programmet"
Sponsrad av
Sparbank      Balkheds
Gränsbygden   Derome
```

- **A credit line, not an ad slot.** From `md` up the sponsors sit right-aligned
  between the header and the lead photo, the way a magazine credits a sponsor
  beside its masthead. They are on the first screen at every desktop size and
  push the lead down about 20 px. On a phone the same line would put the lead
  photo below the fold, so there they follow the lead and the programme. The
  component renders twice, one hidden at each width (`Sponsors.astro`).
- **One ink.** The logos came in four styles (three white for WordPress's black
  sidebar, one blue on a white box), so each file is an alpha mask and CSS
  paints them all `muted-foreground`, `foreground` on hover. That makes them
  quiet, makes them agree with each other and keeps the site's colour on
  action. It costs the bank's orange coin, which reads as a
  grey one.
- **Sized by eye to weigh the same**, not to one height: equal height made the
  bold wordmarks (Derome, Balkheds) shout and equal area lost the bank's thin
  serif.
- Home page only. `rel="sponsored"` on each link. The list lives in the
  component; making it editable in `/admin` needs a table and is not built.

### Home

```
360 px                                   desktop
────────────────────────                 ───────────────────────────────────────────
[ lead photo, full-bleed ]               [ lead photo, 64rem wide, natural ratio   ]

Lördag 19 september                      lördag         Sträckräkning på
Sträckräkning på                         19 september   Skararps ängar          ← display
Skararps ängar          ← display        Referat
                                                        Ingress, two or three lines,
Ingress …                                               muted.

Tidigare                                 Tidigare
12 sep   Titel på artikeln               12 sep         Titel på artikeln
         Ingress på en rad …                            Ingress på en rad …
 3 sep   Titel …                          3 sep         Titel …
…                                        …
Alla artiklar                                           Alla artiklar
```

- The lead article's **whole headline is the link**. There's no "Läs mer" and
  no arrow.
- **Without a cover photo, the lead is purely typographic.** The display
  headline carries it, and the layout must not leave a hole. ~~Only 14 of the
  353 WordPress posts have a featured image, so this is the common case until
  the import picks a cover (step 8, F2).~~ The import set 8 covers, but 222
  posts carry photos in the body, so this is now the rare case; see
  [Tidskriften](#tidskriften-2026-10-24).
- ~~**"Tidigare"** holds the next 8 articles: the date in the margin column
  (day and month; the year only when it differs from the current year), the
  title as the link, one line of ingress.~~ Replaced by "Fler artiklar"
  (2026-10-24).
- ~~**Room for later steps:** larm (step 4) goes between the lead and
  "Tidigare", and the next program item (step 5) above the lead.~~ Both are
  there now. Each shows nothing at all when it is empty; no placeholders.

### Article list (`/artiklar`, categories)

```
Artiklar                                   ← H1
Alla  Föreningsaktuellt  Referat  Program  ← category links, current underlined

19 sep   Sträckräkning på Skararps ängar
2026     Ingress …
12 sep   …
…
Äldre artiklar                             ← keyset link, and "Nyare artiklar" when not first
```

The year prints in the margin under the first entry of each year, so a scroll
back through time reads like turning notebook pages.

### Article

```
desktop
Artiklar / Referat                        ← breadcrumb links
               Sträckräkning på Skararps ängar          ← H1
lördag         Ingress … (or the cover, or the body: whatever comes first)
19 september
2026
Text: Anna A.
               [ cover photo, column width ]
               Body, content.css, 38rem …
```

- **The date sits beside the first thing after the title.** The article is one
  grid; the margin block is placed in row 2 spanning two rows, and everything
  else flows down the reading column. As a header row of its own it opened a
  120 px gap between title and text on every article without an ingress, which
  is nearly all of them (fixed 2026-10-24). The event page works the same way.

- On mobile, the margin collapses into one meta line above the body: the date,
  then "Text: …" on the next line. There are no middle-dot strings.
- After the body comes "Mer i Referat", with "Visa alla" to the category.
- A shared article shows its first photo and opening line (Open Graph), so a
  link posted in a Facebook group isn't a bare URL.

### Larm (`/larm`, `/larm/<id>`)

A larm has no headline. It has a species, a count, a place and a time — which is
the notebook entry the direction above describes, almost literally. So the row
is built from those and nothing else:

```
desktop
19 sep.        Kungsörn  2 ex.  Mycket sällsynt     ← species is the link
2026           Nära Hualtet    Anna Andersson      ← place, then observer
08:15          [ photo ]
```

- **The margin carries the clock**, which articles don't have: date, year when
  it changes, then the time. `tabular-nums`, as everywhere.
- **Place and observer are two elements in one flex row**, separated by a gap.
  Not a `·` string — the same reason the article meta is split into lines.
- **`N ex.` only when N > 1.** "1 ex." is noise, and "ex." is how a birder
  writes it.
- **Rarity is a word, and only when it means something.** It prints from
  "Ovanlig" (level 2) up and is silent below, so its presence is the
  information. It takes the `--rarity` colour only at levels 0–1. Nothing in the
  first 238 larm was level 0 or 1 and 191 were level 4–5, so a coloured badge on
  every row — which is what the app does, correctly, in a dense phone feed —
  would have been decoration here. The word itself comes from the app
  (`Mycket sällsynt` … `Allmän`), so a bird reads the same in both places.
- **Photos.** Member uploads carry no stored dimensions, so both pages reserve a
  3:2 box and nothing shifts as they load. The feed **crops** (`object-cover`)
  to keep the list's rhythm; the detail page shows the photo **whole**
  (`object-contain`), portrait or landscape, which is where the brief's
  "uncropped where the layout allows" actually applies. The feed is 12 per page,
  not 20, and lazy-loads: originals average 0.5 MB and there is no transform
  service. (Superseded 2026-10-24: Storage resizes the photos now, so the feed
  loads 480/960-wide WebP files of about 27 KB, and shows them in a right-hand
  column from `md` up rather than across the reading column.)
- ~~**Full-size photos appear on `/larm` and on a larm's own page; the home page
  gets thumbnails.**~~ (Superseded 2026-10-24 by the larm rail.) The first draft showed full-width photos everywhere, and
  four of them under the home page's lead article made the larm section the
  largest thing on the page, against the rule that the lead is the one loud
  thing. So "Senaste larmen" shows each photo as a small square print beside
  its row (`photos="thumb"`: 80 px on a phone, 112 px from `md`), with the text
  kept together on the left; a larm without a photo is just the plain row.
  The thumbnails still load the originals, since there is no transform
  service, but they lazy-load below the lead. "Fler larm" on a larm's own
  page and the lokal pages stay photo-free (`photos={false}`).
- **The page says the place is approximate**, under the heading on `/larm` and
  again on the detail page. Readers deserve to know that "Nära Hualtet" is a
  deliberate blur, not a measurement.
- **Where to get the app** (`AppLinks.astro`, 2026-10-24): one sentence in the
  app's own verbs ("larmar", "notiser") and two plain links, App Store and
  Google Play. It sits under the ingress on `/larm` and closes "Senaste larmen"
  on the home page, after the larm rather than before them. Not the stores'
  badges: two black slabs would be the loudest thing in the section. Both links
  always show, because the pages are cached alike for every visitor.

### Kalender (`/kalender`, `/kalender/<månad>`, `/kalender/<slug>`)

The programme is the one part of the site that is read **forwards**. Everything
else here is a record of what happened; this is what a member is deciding
whether to come to. The row is the larm row's grammar with two changes that
follow from that:

```
desktop
September 2026                               ← month heading

fredag         Ugglespaning vid Hualtet      ← title is the link
25 sep.        Exkursion   Samling vid Ekebacken
14:38          Vi lyssnar efter pärluggla …
```

- **The weekday is spelled out**, because that is how the club writes its
  programme ("Lördag 21 februari – Ugglespaning") and it is what a member reads
  first when deciding whether they can come. Larm and articles print only the
  date.
- **No year in the margin.** The month heading above the list carries it, so
  repeating it per row would be the noise the article list avoids by printing
  the year only when it changes.
- **Type and place are two elements in a flex row**, not `Exkursion · Ekebacken`
  — the same rule as the larm row's place and observer.
- **"Övrigt" prints nothing.** The type is shown only when it says something;
  an event whose type is "other" is described by its own title.
- **A grid was rejected.** The club runs a couple of events a month, so a month
  grid would be mostly empty squares, and it reads badly at 360 px. The month
  pages are the same list, filtered, with the neighbouring months linked at the
  foot — side by side in the reading column, not pushed to the container's
  edges, where they read as unrelated.
- **The clock is dropped for an all-day event** rather than printed as 00:00.

An event's own page follows the article page: the summary is the ingress,
under the title, and the **place sits level with the date**, as the first line
of the reading column, in 18 px medium ink (since 2026-10-24; before, the place
came above the ingress and was outsized by it). When and where read as one
row, the way the larm page sets where the bird was beside when. The margin
carries weekday, date, year, time, then the type. "Anmäl dig" is a plain green
link, not a button — the site spends colour on what can be clicked and keeps
the one button for elsewhere.

~~On the **home page** the next event sits **above the lead**, as one quiet line:
a small heading, the weekday and time, the title as the link. It is the first
thing on the page and the smallest, which is the point — the lead article stays
the one loud thing.~~ Since 2026-10-24 the next three events sit **beside the
lead headline** from `lg` up, in the column the reading layout left empty, and
under the lead below that; see [Tidskriften](#tidskriften-2026-10-24).

`/kalender.ics` is offered on `/kalender` as "Prenumerera på programmet", in a
sentence that says what subscribing does. It is not offered on an event's page,
where it would promise to add that one event and actually add the whole
programme.

### Lokaler (`/lokaler`, `/lokaler/<slug>`)

A map is the one thing on this site that resists a reading column, so it gets
treated as a picture: **the map is `/lokaler`'s one loud thing**, exactly as the
lead photo is the home page's, at the container's full 64rem with the 4px radius
photos use. The register under it is not a second copy of the map — it is the
map's keyboard and screen-reader equivalent, which is why the island marks
itself `aria-hidden` and its markers are not focusable. Put 61 pins in the tab
order and you have made the page worse for the people the register serves.

```
Lokaler
Klubbens lokaler i Markaryds kommun. En grön prick betyder att någon
larmat därifrån de senaste två veckorna.        ← the legend as a sentence, not a legend box

[ kartan, 64rem, kommungränsen streckad, 61 prickar ]

A      Agghult/Traryd
       Altaböke sjö
       Anderslöv             1 larm   senast 20 aug.
B      Broarna i Timsfors    9 larm   senast 16 aug.
```

- **The frame is near-square** (`aspect-square`, `md:aspect-3/2`). The kommun is
  19 km by 18, so a wide frame shows no more of it — it just zooms out until
  Laholm and Osby are on screen and the club's own ground is a patch in the
  middle. This was the first draft and the screenshot settled it.
- **The letter takes the margin**, printed only when it changes, which is the
  article list's year device applied to a register. Swedish collation, so Å, Ä
  and Ö file at the end and the heading agrees with the sort. On a phone the
  margin collapses and the letter **disappears** rather than sitting alone above
  the name, where it would only repeat the name's first letter.
- **The tally is two elements in a flex row**, `12 larm` and `senast 12 sep.`,
  never a middle-dot string. A lokal nobody has larmed from prints nothing, the
  way a common bird prints no rarity.
- **The tally counts only larm sent *from* the lokal** — the app's 300 m rule,
  nearest-wins. Counting the three-kilometre band too was tried and is wrong:
  109 larm lie within 3 km of Broarna i Timsfors and 9 came from it, and those
  109 are mostly the same reports counted again at every other lokal in town. A
  register built on that ranks a dozen places identically and calls each a
  hotspot. The 78 "at" larm partition cleanly across 22 lokaler.
- **Pins are dots, not teardrops** — 9px, in the site's tokens, with a
  paper-coloured ring so they read over water, forest and road. Green for a larm
  in the last fortnight, Blyerts when quiet, matching the app's legend so a
  member reads the two screens the same way. This is the second place the site
  spends colour on status rather than action, after `--rarity`, and it earns it
  the same way: the app already teaches the code.
- **No popup.** Leaflet's default bubble is a white shadowed rounded card — the
  thing this design refuses everywhere else. Hover or touch shows a tooltip with
  the name; a click goes to the lokal's page.
- **The kommun's border is drawn** as a dashed ink hairline, from the polygon
  step 4 already needed (`src/data/markaryd-boundary.json`). Dashed because an
  atlas draws a boundary that way and it reads as one; the tiles draw the
  neighbouring län and kommuner too, so ours has to be the darkest line.
- **The map never eats the page's scroll** (`scrollWheelZoom` off; the zoom
  buttons and pinch-zoom remain), and its animation respects
  `prefers-reduced-motion`.

A lokal's own page follows the article page, with the map **where the article
has its cover photo**: where it is, is what a visitor acts on, the same reason
the larm page leads with where the bird was. It is a still — one dot, no
dragging, no zooming — at the reading column's width.

```
Lokaler / Reningsdammarna
              Reningsdammarna
              [ stillbild, 38rem, 2:1 ]
              Beskrivning, när det finns en          ← 4 of 61 have one today

På lokalen
15 sep.       Stjärtmes  9 ex.
18:17         Anna Andersson                      ← no place: the heading said it

I närheten
              De 12 senaste larmen inom tre kilometer från lokalen.
              Platsen för ett larm är alltid ungefärlig.
 2 sep.       Kungsfiskare
06:28         Nära Klintbadet   Per Persson
```

- **"På lokalen" prints no place.** The heading has already said where these
  larm came from, and the place ladder would print "Nära Reningsdammarna" on
  Rallvägen's page — true, since the two are neighbours, and a flat
  contradiction to read. The first build did exactly that and the screenshot
  caught it.
- **"På lokalen" is printed whole; "I närheten" stops at twelve.** The first is
  what the page is about and is the number the register promised, so all of it
  must be there. The second is context, and 3 km around tätorten is 60 larm and
  growing.
- **No counts in the headings** and no "Andra lokaler i närheten" at the foot.
  The site writes "Fler larm" and "Här hittar du", not "Fler larm (6)",
  and the breadcrumb already leads back to the map.
- A lokal with nothing says `Inga larm har skickats härifrån ännu.` and offers
  `Se alla larm`.

### Page

The page title and body, in the same column. A section page (one with children)
ends with "Här hittar du", a small grey label over the list Klubben uses:
each title in ink at 18 px, green underline on hover, its description under it.
(It was a column of green underlined links until 2026-10-24, which read as a
sitemap.)

### Klubben (`/om-foreningen`, `/om-foreningen/medlemskap`) — 2026-10-24

Redesigned after an interview with the user, who called joining the section's
most important job. Before, Klubben was a heading over eight bare links; the
join facts were two paragraphs on Medlemskap with "2026" written into them, a
QR code only as a PDF and a broken email link to the kassör. Decisions, in
full, are in the roadmap's decision log.

- **Newcomers first.** Klubben is its own route
  (`src/pages/om-foreningen/index.astro`): the introduction, a "Bli medlem" row
  with the fee and a link onward, the club's text, then "Mer om klubben", each
  page with one line. Verksamhet's pitch and Allmänt's practical text folded in;
  both are drafts now and their URLs 301 to Klubben (`MOVED_PAGES` in
  `src/lib/wp-redirects.ts`, applied to the WordPress map's targets too).
- **The register.** The body's `## Rubrik` headings become the word in the
  7rem margin (`.content-register` in `content.css`), the same device as dates
  on the lists and letters on the lokal register. On a phone the word sits
  above its text, small. The admin keeps writing a plain column.
- **The join page** (`src/pages/om-foreningen/medlemskap.astro`) is the header
  button's target, in the order a newcomer acts:
  - **Avgift <år>:** a real table, label and note in the first cell (who gets
    Cinclus: vuxen and ungdom; a familjemedlem shares the household's) and the
    price right-aligned. Calendar year, no autumn rule.
  - **Så blir du medlem:** numbered, because it is a sequence. 1 pay (Swish
    number, bankgiro), 2 the message ("Anna Svensson medlem 2027"), 3 send the
    postal address by a **prefilled email or SMS** (Swish messages hold about
    50 characters, too few for an address). Then "Klart!" and when Cinclus comes.
  - **Frågor:** the contact person, with `tel:` and `mailto:` links.
- **Swish by device.** On a phone (`pointer: coarse`) each fee row ends in a
  "Swisha" link that opens the app with the amount and "medlem <år>" filled
  in; on a computer (`pointer: fine`) one QR code does the same with the amount
  left open. The link format is Swish's own QR generator output but **not
  documented** (`swishLink` in `src/lib/membership.ts` says where it was
  mapped); the number and bankgiro are always printed as text, so nothing
  depends on it. **Test it on a phone before launch.**
- **One source for the numbers:** `membership_settings`, one row, edited at
  `/admin/medlemskap` (year, three fees, youth age, Swish, bankgiro, contact).
  The contact holds the kassör's own address until the domain has role
  addresses (kassor@…), then it is one edit.
- **The header's one button.** "Bli medlem" is the public site's only filled
  button (`site.astro`): in the bar from `md`, where the menu collapses to
  "Meny" until `lg`; on a phone, the first thing in the opened menu. This
  reverses step 3's decision below, because the user now puts joining first.
- **Not done, waiting on the domain's email:** Kontaktpersoner rewritten around
  role addresses, with phone numbers only for those who want them.
- ~~**Known contrast gap, shared with the app:** the dark theme's green with
  near-white text is 3.26:1.~~ Gone with the dark theme (2026-10-24); light
  mode's button is 4.96:1.

### Footer

~~The club's name, the tagline and the webmaster address in muted text on the
page background, with no band of colour.~~ Rebuilt 2026-10-24 (polish pass): the
old footer floated halfway up every short page and gave a visitor at the end of
an article nowhere to go.

```
( ◉ ) Markaryds Fågelklubb                    Klubben              Appen
      Fågelskådning och naturliv …            Om klubben           Larm
      webmaster@markarydsfagelklubb.nu        Bli medlem           App Store
                                              Program              Google Play
                                              Prenumerera på …     Integritetspolicy
                                              Artiklar som RSS-…   Användarvillkor
```

- **A `muted` band** the width of the window: it marks the end of the page
  without a rule, and it sits at the bottom of a short page (the layout is a
  column of the window's height, `main` takes the slack).
- **Only routes that live in code**, so renaming a page in `/admin` can't break
  the footer; the page tree's pages are one click away in the menu.
- Two link groups side by side even on a phone, so the band stays short.
  Group names are small grey labels, links are ink with a green underline on
  hover, 44 px tall below `md`.

## Menu (signed off 2026-09-20)

Today's WordPress menu has 10 top-level items, and four of them are mostly links
out to Artportalen. The proposal is **five sections**, members' things first:

```
Artiklar              /artiklar                 (link entry)
Larm                  /larm                     (link entry, added in step 4)
Program               /kalender                 (link entry, added in step 5; it replaces the
                                                hand-edited Årsprogram page)
Obsar                 /obsar                    one section for today's "Obsar" and "Listor":
                                                  Rapportera på Artportalen, Kommunobservationer,
                                                  Årslista {year}, Markarydslistan, Observatörsligan,
                                                  the five regions (link entries)
Lokaler               /lokaler                  the map and the 61 lokal pages (step 6). The 9 WP
                                                lokal pages 301 here in step 8
Klubben               /om-foreningen            Verksamhet, Cinclus, Medlemskap, Kontaktpersoner,
                                                  Tävlingar (Vinterfågelrally, Smålandsrallyt),
                                                  Fågelholkar, Länkar
```

- **Larm is its own top-level section**, not filed under Obsar, because the
  agenda calls it *"viktig funktion"* and because Obsar is where the club sends
  people *out* to Artportalen, while Larm is the club's own material.
- **Moved pages change path.** Medlemskap moves from `/medlemsskap/` to
  `/om-foreningen/medlemskap`, and `/svalan/` and `/listor/` become `/obsar`.
  Their old URLs go into step 8's redirect map along with the posts'.
- **Step 8 builds the tree from this, signed off 2026-09-20.** Step 3 runs on dummy pages
  that mirror the shape (`exempel-` slugs).
- **Year-dependent link text** ("Årslista {year}") is fixed by hand each New
  Year until F7 phase A computes it.

## Review against the brief

Where the first draft drifted to a default, and what changed:

- **The margin date list** risked becoming a broadsheet: hairlines between
  entries and dense columns. It now uses space between entries and one rule
  under the header only.
- **The article meta** was first drafted as `19 sep 2026 · Referat · Anna A.`,
  a middle-dot template string. It's now split into margin lines, each one
  piece of information.
- **"Läs mer →" under the lead** was the generic link. Removed: the headline is
  the link.
- ~~**A "Bli medlem" button in the header** served newcomers, whom the brief
  puts second. It moved to the footer and the Klubben section.~~ Reversed
  2026-10-24: the user puts joining first, so the header has it (see Klubben).
- **A green band behind the header** would have spent colour on decoration,
  which the app's own rule reserves for action. Dropped.
- **Kept deliberately:**
  - the date margin, which is the notebook's own structure, not a blog
    affectation;
  - the display-size lead, the one place the design is loud.

## Rendered content (`src/styles/content.css`)

One stylesheet for article and page HTML, scoped to `.content`. The Tiptap
editor loads it too, so the admin sees what gets published.

- `h2`–`h4` follow the scale; space above equals 1.6× the space below, so a
  heading binds to its section.
- Paragraphs and lists: `1em` between blocks. Lists are indented with outside
  markers.
- **Links** are green and underlined (`text-underline-offset: 0.2em`, 1 px,
  2 px on hover). In body text a link must look like one.
- `blockquote` is indented, in the muted colour, with no quote glyphs or bars.
- **Images:** full column width, `height: auto`, 4 px radius, `1.5em` vertical
  space. `width`/`height` are always present, so nothing shifts.
- **Captions** (`<figure><img><figcaption>`, 2026-10-24): meta size (14 px),
  Blyerts, 0.625rem under the photo, so a photo credit never reads as a
  paragraph of the article. The figure is as wide as its photo and the
  caption wraps under it (`contain: inline-size`), which matters for the
  300 px originals. In the editor, a selected photo gets a "Bild" row with
  "Lägg till bildtext" / "Ta bort bildtexten"; an empty caption shows a
  placeholder and is stored as the plain image.
- **Tables:** full width, meta-size text, a bottom border per row, and the
  header row at 600 weight. Tables scroll horizontally inside themselves at
  360 px; the page never does.
- **Embeds:** full width, no border, a 4:3 ratio for maps.
- `em` is italic (scientific names), and `strong` is 600.

## RSS (`/feed`, 2026-10-24)

The newest twenty articles as RSS 2.0, with each article's opening line,
category and photo (Media RSS), for feed readers and for the tools that post
a club's news to Facebook. It lives at `/feed` because WordPress had it at
`/feed/`, which the site 301s to `/feed`, so old subscribers keep it. Every
page links it for discovery (`rel="alternate"`), and the footer's Klubben group
lists it as "Artiklar som RSS-flöde". An hour's cache, as for the calendar.

## Notes for later passes

- ~~Larm (step 4) brings the first colour beyond green: rarity.~~ Done: a
  `--rarity` token (`oklch(0.536 0.191 29)`), taken from the app's
  `RarityScale` 0–1 (`#C42A20`); its dark lift went with the dark theme. It is
  deliberately **not** `--destructive`, which means "this will break something".
  Spent on rarity levels 0–1 only.
- If the display lead ever feels too loud for a trivial post (e.g. "Inställt
  arbetsmöte"), consider an editor option "visa inte som huvudnyhet". Don't
  build it until it's needed.
