import { dayOfYear } from "./artportalen/aggregate"
import type { Season, SeasonTaxon, YearStats } from "./artportalen/types"
import { toStockholmInputValue } from "./stockholm-time"

/**
 * "Så här års" (docs/design.md, "Så här års"): which birds usually
 * arrive in the kommun, or leave it, around today, from the typical days the
 * nightly job keeps in the `season` key, and what this year has done so far.
 */

/**
 * Two weeks back and two ahead: "this time of year". A narrower window left
 * the block empty for weeks on end in late autumn, when little moves.
 */
export const WINDOW_BEFORE = 14
export const WINDOW_AFTER = 14
/** Each list stays short enough to read as a sentence's worth of birds. */
export const MAX_PER_LIST = 6

export type SeasonBird = {
  id: number
  name: string
  sci: string
  /** The typical day (1-based day of the year). */
  day: number
  /** A winter guest's arrival is its autumn return, and its date this year the latest report. */
  kind: "summer" | "winter"
  /**
   * This year so far: the first sighting for an arriving bird, the latest for
   * a leaving one, as `YYYY-MM-DD`, or null when none has been reported.
   */
  thisYear: string | null
}

export type ThisWeek = { arriving: SeasonBird[]; leaving: SeasonBird[] }

/** Days from `today` to `day`, the short way round the year. */
function offset(day: number, today: number): number {
  let diff = day - today
  if (diff > 183) diff -= 365
  if (diff < -183) diff += 365
  return diff
}

const inWindow = (day: number, today: number) => {
  const diff = offset(day, today)
  return diff >= -WINDOW_BEFORE && diff <= WINDOW_AFTER
}

/**
 * What this year has to say about the bird. A summer bird's arrival is its
 * first report and its departure its latest. A winter guest is here when the
 * year begins, so its first report says nothing about the autumn: it counts as
 * back once a report falls within a fortnight of its usual return, or later.
 */
function seenThisYear(
  taxon: SeasonTaxon,
  kind: "arrival" | "departure",
  year: { first: string; last: string; arrival?: string },
  day: number
): string | null {
  if (kind === "departure") return year.last
  // A summer bird's arrival, not a January report of one that wintered.
  if (taxon.kind === "summer") return year.arrival ?? year.first
  return dayOfYear(year.last) >= day - 14 ? year.last : null
}

export function thisWeek(season: Season | null, now: Date, current: YearStats | null): ThisWeek {
  if (!season) return { arriving: [], leaving: [] }
  const today = dayOfYear(toStockholmInputValue(now).slice(0, 10))
  const seen = new Map((current?.species ?? []).map((one) => [one.id, one]))

  const pick = (kind: "arrival" | "departure") =>
    season.taxa
      .flatMap((taxon) => {
        const day = taxon[kind]
        if (day === null || !inWindow(day, today)) return []
        const year = seen.get(taxon.id)
        return [
          {
            id: taxon.id,
            name: taxon.name,
            sci: taxon.sci,
            day,
            kind: taxon.kind,
            thisYear: year ? seenThisYear(taxon, kind, year, day) : null,
          },
        ]
      })
      .sort(
        (a, b) => offset(a.day, today) - offset(b.day, today) || a.name.localeCompare(b.name, "sv")
      )
      .slice(0, MAX_PER_LIST)

  return { arriving: pick("arrival"), leaving: pick("departure") }
}
