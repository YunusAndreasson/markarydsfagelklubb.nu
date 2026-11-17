import { dayOfYear } from "./artportalen/aggregate"
import { seasonWindow, windowWeeks } from "./artportalen/taxa"
import type { Season, SeasonTaxon, TaxonIndex, YearStats } from "./artportalen/types"
import type { MigrationRow } from "./charts/options"
import { speciesHref } from "./species"
import { dayOfYearLabel, MONTH_NAMES, NOT_IN_SPRING, weekOfDay } from "./species-page"
import { stockholmYear, toStockholmInputValue } from "./stockholm-time"

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
/**
 * What the dates are. The source, Artportalen, is said once per page by its
 * source line (`SourceNote`), so the note doesn't repeat it.
 */
export const SEASON_NOTE = "Datumen är medianen för de senaste tjugo åren."

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

/**
 * "Flyttfåglarnas år" (docs/design.md, "Obsar och statistik"): every bird with
 * a season, its usual year as reports per week over the twenty-year window, in
 * the order the birds come. The whole year behind "Så här års".
 */
export type Migration = {
  /** Summer birds by usual arrival, then winter guests by their autumn return. */
  summer: MigrationRow[]
  winter: MigrationRow[]
  /** How many years the weeks are summed over. */
  years: number
  /** The week bin today falls in. */
  today: number
  /** The month most summer birds arrive in, and how many of them do. */
  busiest: { month: string; count: number } | null
}

const monthOfDay = (day: number) => new Date(Date.UTC(2025, 0, day)).getUTCMonth()

/** The first week a bird is usually reported, for one with no usual day to sort by. */
const firstWeekDay = (weeks: readonly number[]) => {
  const week = weeks.findIndex((count) => count > 0)
  return week < 0 ? 366 : week * 7 + 4
}

export function migration(
  season: Season | null,
  index: TaxonIndex | null,
  current: YearStats | null,
  slugs: Map<number, string>,
  now: Date
): Migration | null {
  if (!season || !index) return null
  const today = dayOfYear(toStockholmInputValue(now).slice(0, 10))
  const thisYear = stockholmYear(now)
  const window = seasonWindow(index.years, thisYear)
  const seen = new Map(
    current?.year === thisYear ? current.species.map((one) => [one.id, one]) : []
  )

  const rows = season.taxa.flatMap((taxon) => {
    const entry = index.taxa[taxon.id]
    if (!entry) return []
    const weeks = windowWeeks(entry, window)
    if (!weeks.some((count) => count > 0)) return []
    const slug = slugs.get(taxon.id)
    // A summer bird's arrival, as the species page reads it: not a January
    // report of one that wintered, and not a first report long after the
    // usual day, which is no arrival (`NOT_IN_SPRING`).
    const year = taxon.kind === "summer" ? seen.get(taxon.id) : undefined
    const came = year ? (year.arrival ?? year.first) : null
    const late =
      came !== null && taxon.arrival !== null && dayOfYear(came) - taxon.arrival >= NOT_IN_SPRING
    const day = came && !late ? dayOfYear(came) : null
    const row: MigrationRow = {
      name: taxon.name,
      href: slug ? speciesHref(slug) : null,
      weeks,
      arrival: taxon.arrival === null ? null : dayOfYearLabel(taxon.arrival),
      departure: taxon.departure === null ? null : dayOfYearLabel(taxon.departure),
      thisYear: day === null ? null : { week: weekOfDay(day), day: dayOfYearLabel(day) },
    }
    return [
      { row, kind: taxon.kind, usual: taxon.arrival, order: taxon.arrival ?? firstWeekDay(weeks) },
    ]
  })
  rows.sort((a, b) => a.order - b.order || a.row.name.localeCompare(b.row.name, "sv"))

  const summer = rows.filter((one) => one.kind === "summer")
  const months = Array.from({ length: 12 }, () => 0)
  for (const { usual } of summer) {
    if (usual !== null) months[monthOfDay(usual)] = (months[monthOfDay(usual)] ?? 0) + 1
  }
  const top = Math.max(...months)
  const month = months.indexOf(top)

  return {
    summer: summer.map((one) => one.row),
    winter: rows.filter((one) => one.kind === "winter").map((one) => one.row),
    years: window.length,
    today: weekOfDay(today),
    busiest: top > 0 ? { month: MONTH_NAMES[month] ?? "", count: top } : null,
  }
}
