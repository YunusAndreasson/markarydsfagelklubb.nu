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
- **Room for later steps:** larm (step 4) goes between the lead and
  "Tidigare", and the next program item (step 5) above the lead. Both slots are
  empty until those steps; no placeholders are shown.

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

### Page

The page title and body, in the same column. A section page (one with children)
ends with "I det här avsnittet": a plain list of its pages, each with its
description.

### Footer

The club's name, the tagline and `webmaster@markarydsfagelklubb.nu`, aligned
with the reading column, in muted text on the page background, with no band of
colour. Links to Medlemskap and Kontaktpersoner come with the real page tree
(step 8); until then, those pages don't exist.

## Menu proposal (for sign-off)

Today's WordPress menu has 10 top-level items, and four of them are mostly links
out to Artportalen. The proposal is **five sections**, members' things first:

```
Artiklar              /artiklar                 (link entry)
Program               /program                  Allmänt, Årsprogram 2026 (kalender from step 5)
Obsar                 /obsar                    one section for today's "Obsar" and "Listor":
                                                  Rapportera på Artportalen, Kommunobservationer,
                                                  Årslista {year}, Markarydslistan, Observatörsligan,
                                                  the five regions (link entries)
Lokaler               /fagellokaler             the 9 lokal pages, WordPress paths kept
Klubben               /om-foreningen            Verksamhet, Cinclus, Medlemskap, Kontaktpersoner,
                                                  Tävlingar (Vinterfågelrally, Smålandsrallyt),
                                                  Fågelholkar, Länkar
```

- **Moved pages change path.** Medlemskap moves from `/medlemsskap/` to
  `/om-foreningen/medlemskap`, and `/svalan/` and `/listor/` become `/obsar`.
  Their old URLs go into step 8's redirect map along with the posts'.
- **Step 8 builds the tree from this sign-off.** Step 3 runs on dummy pages
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

- Larm (step 4) brings the first colour beyond green: rarity. Design it then,
  from the app's own rarity scale.
- If the display lead ever feels too loud for a trivial post (e.g. "Inställt
  arbetsmöte"), consider an editor option "visa inte som huvudnyhet". Don't
  build it until it's needed.
