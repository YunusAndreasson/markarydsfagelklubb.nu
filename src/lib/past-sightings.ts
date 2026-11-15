import { dayOfYear } from "@/lib/artportalen/aggregate"
import type { PastMonth } from "@/lib/artportalen/types"
import { type RarityLevel, rarityLevel } from "@/lib/rarity"
import { matchApp } from "@/lib/species"

/**
 * "Förr om åren" on the home page (docs/design.md): the kommun's rare and odd
 * birds from earlier years, within a few days of today's date.
 *
 * Artportalen says what was seen when (the nightly `ap:v1:past:MM` keys, which
 * hold only species-years with few reports); the club's larm prefix says what
 * is rare. Measured on 68 years of the kommun's data on 2026-11-15, prefix 0–2
 * alone leaves a median of four sightings a week and some weeks with none,
 * while letting every 3 and 4 in floods it (hundreds in a spring week). So a 3
 * or 4 counts only in a year it was scarce here: a "Mindre allmän" bird
 * reported three times that year, an "Ganska allmän" one reported once. That
 * shows something on every day of the year, about fifteen species a week,
 * which {@link splitPast} trims to the rarest four of each kind.
 */

/** Days either side of today. */
export const WINDOW_DAYS = 3
/** A prefix this rare or rarer always counts. */
export const ALWAYS_UP_TO = 2
/** A prefix-3 bird counts in a year with at most this many reports. */
export const SCARCE_3 = 3
/** A prefix-4 bird counts in a year with at most this many reports. */
export const SCARCE_4 = 1
/** Birds per list, as Fynd i kommunen shows four of each. */
export const PER_GROUP = 4

export type PastSighting = { year: number; date: string }

export type PastSpecies = {
  taxonId: number
  /** Capitalised, as the club writes it. */
  name: string
  rarity: RarityLevel
  /** Newest first; `date` is `YYYY-MM-DD`. */
  sightings: PastSighting[]
}

/** Rare enough to show, by the club's prefix and that year's reports here. */
export function worthShowing(rarity: RarityLevel, reportsThatYear: number): boolean {
  if (rarity <= ALWAYS_UP_TO) return true
  if (rarity === 3) return reportsThatYear <= SCARCE_3
  if (rarity === 4) return reportsThatYear <= SCARCE_4
  return false
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
    for (const [taxonId, year, day, reports] of month.days) {
      if (year >= thisYear) continue
      const apart = daysApart(day, monthDay)
      if (apart > WINDOW_DAYS) continue
      const taxon = month.names[taxonId]
      const own = taxon ? match(taxon) : undefined
      // A bird not on the club's list has no prefix to go by.
      if (!own) continue
      const rarity = rarityLevel(own.rarity)
      if (!worthShowing(rarity, reports)) continue

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

/**
 * The two lists the section shows (`RegisterSet`): birds rare here at any
 * time, and common-ish ones in a year they were scarce, the rarest four of each.
 */
export function splitPast(birds: readonly PastSpecies[]): {
  rare: PastSpecies[]
  scarce: PastSpecies[]
} {
  return {
    rare: birds.filter((one) => one.rarity <= ALWAYS_UP_TO).slice(0, PER_GROUP),
    scarce: birds.filter((one) => one.rarity > ALWAYS_UP_TO).slice(0, PER_GROUP),
  }
}
