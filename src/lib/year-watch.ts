import { dayOfYear } from "./artportalen/aggregate"
import type { TaxonEntry, TaxonIndex, TaxonYear } from "./artportalen/types"
import { countWord } from "./species-page"

/**
 * "Året så här långt" (docs/design.md): this year against the last twenty,
 * from the per-taxon index. Two questions, both asked at the same point in the
 * year so a November page doesn't compare ten months with twelve:
 *
 * - **Saknas i år**: a bird nearly always seen by this date, not reported yet.
 * - **Ovanligt mycket, ovanligt lite**: a bird's share of the year's reports
 *   so far against its usual share by the same week. A share, not a count:
 *   the kommun has twice the reporters it had in 2010, so every bird gets more
 *   reports, and a raw count would call that a boom.
 *
 * Pure: the page passes the index, the window, the year and today.
 */

/** "Nearly always": seen by this date in at least this share of the window's years. */
export const MISSING_SHARE = 0.8
/** A window shorter than this has no "nearly always". */
export const MIN_WINDOW = 15
/** A bird seen by this date in fewer of the window's years has no "usual share". */
export const UNUSUAL_MIN_YEARS = 10
/** "Ovanligt mycket" needs at least this many reports this year, "ovanligt lite" this many expected. */
export const UNUSUAL_MIN_REPORTS = 10
/** Twice the usual, or half. */
export const UNUSUAL_RATIO = 2
/** The lists stay short. */
export const MAX_PER_LIST = 6

const firstDay = (year: number, data: TaxonYear) => dayOfYear(`${year}-${data.f}`)

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : Math.round(((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2)
}

/**
 * Seen last year and in two of the last three: a taxon Artportalen has since
 * renamed or split stops being reported under its old id, and must not read
 * as a bird gone missing.
 */
function stillReported(entry: TaxonEntry, thisYear: number): boolean {
  if (!entry.years[thisYear - 1]) return false
  const recent = [thisYear - 1, thisYear - 2, thisYear - 3].filter((year) => entry.years[year])
  return recent.length >= 2
}

export type Missing = {
  /** Years of the window it had been seen by today's date. */
  byNow: number
  of: number
  /** The median first sighting over the window, as a 1-based day of the year. */
  usual: number
}

/** Whether this bird is missing this year: nearly always seen by now, not yet. */
export function missingNote(
  entry: TaxonEntry,
  window: readonly number[],
  thisYear: number,
  today: number
): Missing | null {
  if (window.length < MIN_WINDOW || entry.years[thisYear]) return null
  if (!stillReported(entry, thisYear)) return null
  const firsts = window.flatMap((year) => {
    const data = entry.years[year]
    return data ? [firstDay(year, data)] : []
  })
  const byNow = firsts.filter((day) => day <= today).length
  if (byNow < window.length * MISSING_SHARE) return null
  return { byNow, of: window.length, usual: median(firsts) }
}

export type MissingBird = Missing & { id: number; name: string }

/** Every missing bird, the surest first. */
export function missingBirds(
  index: TaxonIndex,
  window: readonly number[],
  thisYear: number,
  today: number
): MissingBird[] {
  return Object.entries(index.taxa)
    .flatMap(([id, entry]) => {
      const note = missingNote(entry, window, thisYear, today)
      return note ? [{ id: Number(id), name: entry.name, ...note }] : []
    })
    .sort((a, b) => b.byNow - a.byNow || a.usual - b.usual)
    .slice(0, MAX_PER_LIST)
}

/** The week bins before today's, so a half-written week doesn't count against a whole one. */
export function weeksBefore(today: number): number {
  return Math.min(53, Math.floor((today - 1) / 7))
}

const upTo = (data: TaxonYear | undefined, weeks: number) =>
  (data?.w ?? []).reduce((sum, [week, count]) => (week < weeks ? sum + count : sum), 0)

/** Every taxon's reports before week `weeks`, summed, for each year asked. */
export function yearTotals(
  index: TaxonIndex,
  years: readonly number[],
  weeks: number
): Map<number, number> {
  const totals = new Map(years.map((year) => [year, 0]))
  for (const entry of Object.values(index.taxa)) {
    for (const year of years)
      totals.set(year, (totals.get(year) ?? 0) + upTo(entry.years[year], weeks))
  }
  return totals
}

export type Unusual = {
  /** This year's reports so far over the usual share's worth of them. */
  ratio: number
  count: number
  expected: number
}

/** How far this year's share of the bird's reports is from its usual share, when it is far. */
export function unusualNote(
  entry: TaxonEntry,
  window: readonly number[],
  thisYear: number,
  weeks: number,
  totals: Map<number, number>
): Unusual | null {
  const total = totals.get(thisYear) ?? 0
  if (weeks < 4 || total === 0 || !stillReported(entry, thisYear)) return null
  const counted = window.filter((year) => (totals.get(year) ?? 0) > 0)
  if (counted.length < MIN_WINDOW) return null
  if (counted.filter((year) => upTo(entry.years[year], weeks) > 0).length < UNUSUAL_MIN_YEARS) {
    return null
  }
  const share =
    counted.reduce(
      (sum, year) => sum + upTo(entry.years[year], weeks) / (totals.get(year) as number),
      0
    ) / counted.length
  const expected = share * total
  const count = upTo(entry.years[thisYear], weeks)
  if (count === 0 || expected === 0) return null
  const ratio = count / expected
  const more = ratio >= UNUSUAL_RATIO && count >= UNUSUAL_MIN_REPORTS
  const less = ratio <= 1 / UNUSUAL_RATIO && expected >= UNUSUAL_MIN_REPORTS
  return more || less ? { ratio, count, expected: Math.round(expected) } : null
}

export type UnusualBird = Unusual & { id: number; name: string }

/** The birds far above and far below their usual share, the furthest first. */
export function unusualBirds(
  index: TaxonIndex,
  window: readonly number[],
  thisYear: number,
  today: number
): { more: UnusualBird[]; less: UnusualBird[] } {
  const weeks = weeksBefore(today)
  const totals = yearTotals(index, [...window, thisYear], weeks)
  const all = Object.entries(index.taxa).flatMap(([id, entry]) => {
    const note = unusualNote(entry, window, thisYear, weeks, totals)
    return note ? [{ id: Number(id), name: entry.name, ...note }] : []
  })
  return {
    more: all
      .filter((one) => one.ratio > 1)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, MAX_PER_LIST),
    less: all
      .filter((one) => one.ratio < 1)
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, MAX_PER_LIST),
  }
}

const FRACTIONS = [
  "",
  "",
  "hälften",
  "en tredjedel",
  "en fjärdedel",
  "en femtedel",
  "en sjättedel",
  "en sjundedel",
  "en åttondel",
  "en niondel",
  "en tiondel",
]

/**
 * "dubbelt så många rapporter som vanligt", "en åttondel så många rapporter
 * som vanligt". Rounded toward the usual both ways, so it never says more than
 * the numbers do: 5.6 times is "fem gånger", an eighth and a bit is "en åttondel".
 */
export function ratioPhrase(ratio: number): string {
  if (ratio >= 1) {
    const times = Math.floor(ratio)
    if (times <= 2) return "dubbelt så många rapporter som vanligt"
    if (times > 10) return "mer än tio gånger så många rapporter som vanligt"
    return `${countWord(times)} gånger så många rapporter som vanligt`
  }
  const part = Math.max(2, Math.floor(1 / ratio))
  if (part > 10) return "mindre än en tiondel så många rapporter som vanligt"
  return `${FRACTIONS[part]} så många rapporter som vanligt`
}
