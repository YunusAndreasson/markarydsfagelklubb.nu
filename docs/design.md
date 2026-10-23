# Design: the public site

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

## Direction: *fältdagboken*

The site reads as the club's shared field notebook.

- **Dates live in a margin.** On lists and articles, the date sits in its own
  narrow column to the left of the text. It's the first thing a member scans
  for, so the layout itself carries it: tabular numerals, the weekday in full
  where it matters ("lördag 19 september"), as the club writes it.
- **One bold thing:** the lead story on the home page. The newest article is set
  at display size in Inter's display cut, with its photo full-bleed on a phone.
  Everything after it is quiet.
- **Quiet everywhere else:** one left-aligned reading column, no cards, no
  decoration, and colour only where something can be clicked.
- **Photos are the members' own work,** shown large, uncropped where the
  layout allows (never a forced square), and always with alt text.

## Tokens

### Colour (existing, shared with the app; unchanged)

| Name | Light | Dark | Use |
|---|---|---|---|
| Papper (background) | `#FFFFFF` | `#080B09` | page |
| Bläck (foreground) | `#0A0A0A` | `#FAFAFA` | text |
| Markarydsgrön (primary) | `#137D41` | `#259F56` | links, the one button, focus |
| Blyerts (muted-foreground) | `#737373` | `#9AA49D` | dates, ingress, meta |
| Linje (border) | `#E5E5E5` | `rgb(255 255 255 / 10%)` | the header rule, tables |

Colour stays reserved for action and status, as in the app. Nothing on the
public site is green unless it is a link or a control.

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
| H2 | 1.5rem | 600 | −0.015em | 1.2 |
| H3 | 1.25rem | 600 | −0.01em | 1.3 |
| H4 | 1.0625rem | 600 | 0 | 1.4 |
| Ingress | 1.1875rem | 400, muted | 0 | 1.5 |
| Body | 1rem → 1.0625rem | 400 | 0 | 1.65 |
| Meta / dates | 0.875rem, `tabular-nums` | 500 | 0 | 1.4 |

- The reading measure is at most **38rem** (about 68 characters).
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
Markaryds Fågelklubb                         Artiklar  Program  Obsar  Lokaler  Klubben
Fågelskådning och naturliv i Markaryds kommun
────────────────────────────────────────────────────────────────────────────────────

360 px
Markaryds Fågelklubb                    [ Meny ]
────────────────────────────────────────────────
```

- The club's name is a wordmark in Inter at 600 weight, linking home. The
  tagline shows from 768 px up.
- **No dropdowns.** A top-level item links to its section page, and that page
  lists the section's pages. It's simple, accessible, and needs no JS.
- **Mobile menu:** a `<details>` disclosure labelled "Meny", which opens the
  whole tree, children indented. No JS, and it works in every browser the club
  uses.
- The current section is marked with `aria-current` and underlined in green.

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
  headline carries it, and the layout must not leave a hole. Only 14 of the
  353 WordPress posts have a featured image, so this is the common case until
  the import picks a cover (step 8, F2).
- **"Tidigare"** holds the next 8 articles: the date in the margin column
  (day and month; the year only when it differs from the current year), the
  title as the link, one line of ingress.
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
lördag         Ingress …
19 september
2026
Text: Anna A.
               [ cover photo, column + margin width ]
               Body, content.css, 38rem …
```

- On mobile, the margin collapses into one meta line above the body: the date,
  then "Text: …" on the next line. There are no middle-dot strings.
- After the body comes "Mer i Referat": three links, the same list pattern.

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
  service.
- **Full-size photos appear on `/larm` and on a larm's own page; the home page
  gets thumbnails.** The first draft showed full-width photos everywhere, and
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

An event's own page follows the article page, with the **place where the
article has its ingress**: where to meet is the fact a member acts on, so it
leads, exactly as the larm page leads with where the bird was. The margin
carries weekday, date, year, time, then the type. "Anmäl dig" is a plain green
link, not a button — the site spends colour on what can be clicked and keeps
the one button for elsewhere.

On the **home page** the next event sits **above the lead**, as one quiet line:
a small heading, the weekday and time, the title as the link. It is the first
thing on the page and the smallest, which is the point — the lead article stays
the one loud thing.

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
  `prefers-reduced-motion`. In dark mode the tiles are **dimmed, not inverted** —
  inverting turns water into land and reads as a different map.

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
  The site writes "Fler larm" and "I det här avsnittet", not "Fler larm (6)",
  and the breadcrumb already leads back to the map.
- A lokal with nothing says `Inga larm har skickats härifrån ännu.` and offers
  `Se alla larm`.

### Page

The page title and body, in the same column. A section page (one with children)
ends with "I det här avsnittet": a plain list of its pages, each with its
description.

### Footer

The club's name, the tagline and `webmaster@markarydsfagelklubb.nu`, aligned
with the reading column, in muted text on the page background, with no band of
colour. Links to Medlemskap and Kontaktpersoner come with the real page tree
(step 8); until then, those pages don't exist.

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
- **A "Bli medlem" button in the header** served newcomers, whom the brief
  puts second. It moved to the footer and the Klubben section.
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
- **Tables:** full width, meta-size text, a bottom border per row, and the
  header row at 600 weight. Tables scroll horizontally inside themselves at
  360 px; the page never does.
- **Embeds:** full width, no border, a 4:3 ratio for maps.
- `em` is italic (scientific names), and `strong` is 600.

## Notes for later passes

- ~~Larm (step 4) brings the first colour beyond green: rarity.~~ Done: a
  `--rarity` token (`oklch(0.536 0.191 29)` light, `oklch(0.62 0.19 29.2)`
  dark), taken from the app's `RarityScale` 0–1 (`#C42A20` / `#D23B2E`) and
  lifted in dark mode to clear AA as text, the same lift `--primary` gets. It is
  deliberately **not** `--destructive`, which means "this will break something".
  Spent on rarity levels 0–1 only.
- If the display lead ever feels too loud for a trivial post (e.g. "Inställt
  arbetsmöte"), consider an editor option "visa inte som huvudnyhet". Don't
  build it until it's needed.
