---
name: artportalen-markaryd
description: Read which birds have been reported in Markaryds kommun on a given day, from Artportalen (formerly Svalan). Use when asked what has been observed or how many birds were seen in Markaryd today, e.g. "hur många fåglar har observerats idag", "kolla Svalan", "kolla Artportalen", "dagens obsar".
argument-hint: "[YYYY-MM-DD] — defaults to today"
---

# Dagens fynd i Markaryds kommun

Svalan is Artportalen's old name. There is no public `svalan.se` to read.

## Read the day

Use the API. It returns birds only and takes any date:

```bash
node .claude/skills/artportalen-markaryd/read-sightings-api.mjs [YYYY-MM-DD]
```

The key is in `.artportalen-keys` in the repo root, which git ignores. A fresh
clone won't have it. Without a key, or if the API fails, read the public page:

```bash
node .claude/skills/artportalen-markaryd/read-sightings.mjs [YYYY-MM-DD]
```

That script opens `https://www.artportalen.se/search/sightings/area/77` in headless
Firefox as an anonymous visitor (no login, no key). It prints the totals, the
count per species and every sighting. Observers are deliberately left out.

The page script covers the **current month only**, because that is the range the
search uses when no date is given. An earlier date comes back empty even if
sightings exist, so check the printed `Range searched` before reporting zero.

## Before answering, if you used the page script

- **Remove anything that isn't a bird.** The search covers every organism group,
  and a row carries no group field. Read the species list, drop plants, insects,
  mammals and so on, and recompute the totals by hand if any were removed.
- **Check the warning.** If the script says not every row was loaded, the day
  may be incomplete.

## How to report it

Answer in Swedish: individuals, species and sightings, then a table per species.
Give the time it was read. Then say what the number doesn't cover:

- The individuals are a **sum of reported counts**, not a census, so the same
  bird can be counted twice.
- Rows without a leading number (e.g. "noterad") aren't in the sum. Name them.
- Only public, confidently identified sightings are included. Protected
  sightings are hidden, and more reports can still arrive that day.
- A new report takes up to five minutes to become searchable.

## If it breaks

- **`Cannot find module 'playwright'` or a missing browser:** the script borrows
  Playwright from `/home/yunus/Work/edenmind-v2`. See the `gecko-screenshots`
  memory for which Firefox build is installed.
- **`No GetSightingsGrid response`:** Artportalen changed the page. The table's
  data comes from `POST /ViewSighting/GetSightingsGrid`, called from the page's
  own script. A plain `curl` of the page returns the table with no rows.
- **URL guesses that don't work:** `/search/sightings/taxon/4000104/area/77/…`
  gives a 404, and adding `/startdate/…/enddate/…` to the area URL never finished
  loading. `/TodaysSightings` shows no sightings without JavaScript.

## The official API

Artportalen has one, the Species Observation System (SOS), at
`https://api.artdatabanken.se/species-observation-system/v1/`. Every request
needs a personal `Ocp-Apim-Subscription-Key`, which **the user** gets from
[the product page](https://api-portal.artdatabanken.se/product#product=sos). Keep
it in `.artportalen-keys`, never in a tracked file.

Tested 2026-10-31: `POST /Observations/Search?skip=0&take=200&translationCultureCode=sv-SE`
matched the page reading exactly (40 sightings, 30 species, 88 individuals). The
filter `read-sightings-api.mjs` sends limits it to birds on the server:

```json
{
  "dataProvider": { "ids": [1] },
  "taxon": { "ids": [4000104], "includeUnderlyingTaxa": true },
  "geographics": { "areas": [{ "areaType": "Municipality", "featureId": "767" }] },
  "date": {
    "startDate": "2026-10-31",
    "endDate": "2026-10-31",
    "dateFilterType": "OverlappingStartDateAndEndDate"
  },
  "output": {
    "fields": [
      "taxon.id",
      "taxon.vernacularName",
      "taxon.scientificName",
      "occurrence.individualCount",
      "event.startDate",
      "location.locality"
    ]
  }
}
```

`output.fields` keeps observers out of the response. A sighting reported only as
"noterad" comes back with a count that adds nothing to the sum. More on the API
is in `docs/roadmap.md`, section "Artportalen".
