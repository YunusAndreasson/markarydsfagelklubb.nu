import { dayOfYear } from "@/lib/artportalen/aggregate"
import type { PastMonth } from "@/lib/artportalen/types"
import { type RarityLevel, rarityLevel } from "@/lib/rarity"
import { matchApp } from "@/lib/species"

/**
 * "Förr om åren" on the home page (docs/design.md): the kommun's rare birds
 * from earlier years, within a week of today's date.
 *
 * Artportalen says what was seen when (the nightly `ap:v1:past:MM` keys, which
 * hold only species-years with few reports); the club's larm prefix says what
 * is rare: 0–2 only. Measured on 68 years of the kommun's data on 2026-11-15,
 * that gives a median of four sightings a week, so the window is a week either
 * side, about eight. Until 2026-11-16 a 3 or 4 filled the gaps in a year it was
 * scarce, under its own heading; a reader couldn't tell why a "ganska allmän"
 * bird stood there, so on a day with no rare bird the section now stays away.
 */

/** Days either side of today. */
export const WINDOW_DAYS = 7
/** A prefix this rare or rarer counts. */
export const RARE_UP_TO = 2
/** Birds the section shows, two columns of four. */
export const PAST_SHOWN = 8

export type PastSighting = { year: number; date: string }

export type PastSpecies = {
  taxonId: number
  /** Capitalised, as the club writes it. */
  name: string
  rarity: RarityLevel
  /** Newest first; `date` is `YYYY-MM-DD`. */
  sightings: PastSighting[]
}

/** Rare enough to show, by the club's prefix. */
export function worthShowing(rarity: RarityLevel): boolean {
  return rarity <= RARE_UP_TO
}

const DAY = 86_400_000

/** The months the window around `today` (`YYYY-MM-DD`) touches: one, or two at a month's edge. */
export function windowMonths(today: string): number[] {
  const noon = Date.parse(`${today}T12:00:00Z`)
  const months = new Set<number>()
  for (let offset = -WINDOW_DAYS; offset <= WINDOW_DAYS; offset++) {
    months.add(new Date(noon + offset * DAY).getUTCMonth() + 1)
  }
  return [...months]
}

/**
 * Days between two `MM-DD`, round the year: a leap year is the yardstick, so
 * 29 February sits between the 28th and 1 March in every year.
 */
export function daysApart(a: string, b: string): number {
  const distance = Math.abs(dayOfYear(`2024-${a}`) - dayOfYear(`2024-${b}`))
  return Math.min(distance, 366 - distance)
}

export function pickPast(
  months: readonly (PastMonth | null)[],
  club: readonly { name: string; sci: string; rarity: number | null }[],
  today: string
): PastSpecies[] {
  const thisYear = Number(today.slice(0, 4))
  const monthDay = today.slice(5, 10)
  const match = matchApp(club)
  const picked = new Map<number, PastSpecies & { nearest: number }>()

  for (const month of months) {
    if (!month) continue
    for (const [taxonId, year, day] of month.days) {
      if (year >= thisYear) continue
      const apart = daysApart(day, monthDay)
      if (apart > WINDOW_DAYS) continue
      const taxon = month.names[taxonId]
      const own = taxon ? match(taxon) : undefined
      // A bird not on the club's list has no prefix to go by.
      if (!own) continue
      const rarity = rarityLevel(own.rarity)
      if (!worthShowing(rarity)) continue

      const entry = picked.get(taxonId) ?? {
        taxonId,
        name: own.name,
        rarity,
        sightings: [],
        nearest: apart,
      }
      const date = `${year}-${day}`
      // One line a year, on the day nearest today's.
      const same = entry.sightings.find((one) => one.year === year)
      if (!same) entry.sightings.push({ year, date })
      else if (apart < daysApart(same.date.slice(5), monthDay)) same.date = date
      entry.nearest = Math.min(entry.nearest, apart)
      picked.set(taxonId, entry)
    }
  }

  return [...picked.values()]
    .sort(
      (a, b) =>
        a.rarity - b.rarity ||
        a.sightings.length - b.sightings.length ||
        a.nearest - b.nearest ||
        a.name.localeCompare(b.name, "sv")
    )
    .map(({ nearest: _nearest, sightings, ...one }) => ({
      ...one,
      sightings: sightings.sort((a, b) => b.year - a.year),
    }))
}
