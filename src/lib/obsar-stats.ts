import { weekIndex } from "@/lib/artportalen/aggregate"
import type { AllTime, History, YearSummary } from "@/lib/artportalen/types"

/**
 * What the Obsar pages say and draw, derived from the stored statistics.
 * Pure, so the sentences and charts can be tested without KV.
 */

/** The club's founding year, the 1986 on the dipper emblem. */
export const FOUNDED = 1986

export type SpeciesCurves = {
  year: number
  /** This year's running count by week bin, up to this week; null after. */
  current: (number | null)[]
  /** Last year's, all year. */
  previous: number[] | null
  /** The mean of up to ten earlier years. */
  average: number[] | null
  /** The fewest and most of the same years, week by week: a normal year's range. */
  low: number[] | null
  high: number[] | null
  averageYears: number
}

/** Week by week, this year against last year and the ten before it (`history` holds the weekly curves). */
export function speciesCurves(history: History, year: number, today: string): SpeciesCurves | null {
  const current = history.years.find((one) => one.year === year)
  if (!current?.weeks) return null
  const thisWeek = year === Number(today.slice(0, 4)) ? weekIndex(today) : 52
  const earlier = history.years
    .filter((one) => one.year < year && one.weeks?.length === 53)
    .sort((a, b) => b.year - a.year)
  const window = earlier.slice(0, 10)
  const previous = earlier.find((one) => one.year === year - 1)
  const across = (pick: (values: number[]) => number) =>
    window.length
      ? Array.from({ length: 53 }, (_, week) => pick(window.map((one) => one.weeks[week])))
      : null
  return {
    year,
    current: current.weeks.map((value, week) => (week <= thisWeek ? value : null)),
    previous: previous?.weeks ?? null,
    average: window.length
      ? Array.from(
          { length: 53 },
          (_, week) =>
            Math.round(
              (window.reduce((sum, one) => sum + one.weeks[week], 0) / window.length) * 10
            ) / 10
        )
      : null,
    low: across((values) => Math.min(...values)),
    high: across((values) => Math.max(...values)),
    averageYears: window.length,
  }
}

/** This week, how far ahead or behind the earlier average this year is, in species. */
export function paceAgainstAverage(curves: SpeciesCurves): number | null {
  const index = curves.current.findLastIndex((value) => value !== null)
  const now = curves.current[index]
  const then = curves.average?.[index]
  if (now === null || now === undefined || then === undefined) return null
  return Math.round(now - then)
}

export type YearRecord = { year: number; value: number }

export function recordYear(
  years: readonly YearSummary[],
  key: "reports" | "species" | "observers"
): YearRecord | null {
  let best: YearRecord | null = null
  for (const one of years)
    if (!best || one[key] > best.value) best = { year: one.year, value: one[key] }
  return best
}

/** The most recent earlier year that beat `year` on `key`, or null if none did. */
export function bestSince(
  years: readonly YearSummary[],
  year: number,
  key: "reports" | "species"
): number | null {
  const value = years.find((one) => one.year === year)?.[key]
  if (value === undefined) return null
  const better = years.filter((one) => one.year < year && one[key] >= value).map((one) => one.year)
  return better.length ? Math.max(...better) : null
}

export type Jubilee = {
  reportsSinceFounding: number
  reportsAll: number
  speciesAll: number
  /** Species recorded at least once since the club began. */
  speciesSinceFounding: number
  firstYear: number | null
  yearsWithReports: number
}

export function jubilee(history: History, allTime: AllTime | null): Jubilee {
  const since = history.years.filter((one) => one.year >= FOUNDED)
  return {
    reportsSinceFounding: since.reduce((sum, one) => sum + one.reports, 0),
    reportsAll: history.years.reduce((sum, one) => sum + one.reports, 0),
    speciesAll: allTime?.taxa.length ?? 0,
    speciesSinceFounding: allTime?.taxa.filter((one) => one.last >= `${FOUNDED}-01-01`).length ?? 0,
    firstYear: history.years[0]?.year ?? null,
    yearsWithReports: history.years.length,
  }
}

/** Every year from the first to the last, zero where nothing was reported. */
export function continuousYears(history: History, from?: number, to?: number): YearSummary[] {
  const first = from ?? history.years[0]?.year
  const last = to ?? history.years.at(-1)?.year
  if (first === undefined || last === undefined) return []
  const byYear = new Map(history.years.map((one) => [one.year, one]))
  const out: YearSummary[] = []
  for (let year = first; year <= last; year++) {
    out.push(
      byYear.get(year) ?? {
        year,
        reports: 0,
        species: 0,
        observers: 0,
        individuals: 0,
        months: new Array(12).fill(0),
        weeks: new Array(53).fill(0),
      }
    )
  }
  return out
}

export type Decade = {
  decade: number
  reports: number
  bestSpecies: number
  observers: number
  years: number
}

export function decades(history: History): Decade[] {
  const map = new Map<number, Decade>()
  for (const one of history.years) {
    const decade = Math.floor(one.year / 10) * 10
    const entry = map.get(decade) ?? { decade, reports: 0, bestSpecies: 0, observers: 0, years: 0 }
    entry.reports += one.reports
    entry.bestSpecies = Math.max(entry.bestSpecies, one.species)
    entry.observers = Math.max(entry.observers, one.observers)
    entry.years++
    map.set(decade, entry)
  }
  return [...map.values()].sort((a, b) => a.decade - b.decade)
}

/** The kommun list growing: species known by the end of each year. */
export function accumulation(
  allTime: AllTime,
  from: number,
  to: number
): { year: number; total: number; added: number }[] {
  const added = new Map<number, number>()
  for (const one of allTime.taxa) {
    const year = Number(one.first.slice(0, 4))
    added.set(year, (added.get(year) ?? 0) + 1)
  }
  const out: { year: number; total: number; added: number }[] = []
  let total = [...added].filter(([year]) => year < from).reduce((sum, [, count]) => sum + count, 0)
  for (let year = from; year <= to; year++) {
    const count = added.get(year) ?? 0
    total += count
    out.push({ year, total, added: count })
  }
  return out
}

/** Each year's reports by month, as shares of that year, for the seasons heatmap. */
export function monthShares(years: readonly YearSummary[]): number[][] {
  return years.map((one) => {
    const sum = one.months.reduce((a, b) => a + b, 0)
    return one.months.map((value) => (sum ? Math.round((value / sum) * 1000) / 10 : 0))
  })
}

/**
 * A local `YYYY-MM-DD` as an instant safely inside that Swedish day, for
 * `formatDate`: midnight UTC would be 01:00 or 02:00 the same day, but noon
 * leaves no doubt.
 */
export function localDay(date: string): string {
  return `${date}T12:00:00Z`
}

/** "1 art", "153 arter". */
export function arter(count: number): string {
  return `${count.toLocaleString("sv-SE")} ${count === 1 ? "art" : "arter"}`
}

/** A route's year: none means this year; anything else must be a year with data. */
export function parseYearParam(
  param: string | undefined,
  years: readonly number[],
  thisYear: number
): number | null {
  if (param === undefined || param === "") return thisYear
  if (!/^\d{4}$/.test(param)) return null
  const year = Number(param)
  return years.includes(year) || year === thisYear ? year : null
}

/** Runs of species by the month they arrived in. */
export function byArrivalMonth<T extends { first: string }>(
  species: readonly T[]
): { month: number; species: T[] }[] {
  const out: { month: number; species: T[] }[] = []
  for (const one of species) {
    const month = Number(one.first.slice(5, 7)) - 1
    const last = out.at(-1)
    if (last?.month === month) last.species.push(one)
    else out.push({ month, species: [one] })
  }
  return out
}

/** Swedish ordinal: "1:a", "2:a", "3:e", "11:e", "21:a", "153:e". */
export function ordinal(n: number): string {
  const last = n % 10
  const lastTwo = n % 100
  return `${n}:${(last === 1 || last === 2) && lastTwo !== 11 && lastTwo !== 12 ? "a" : "e"}`
}

const MONTH = new Intl.DateTimeFormat("sv-SE", { month: "long", timeZone: "UTC" })

/** "januari" for 0; `capital` gives "Januari", for a heading. */
export function monthName(index: number, capital = false): string {
  const name = MONTH.format(new Date(Date.UTC(2024, index, 1)))
  return capital ? name.charAt(0).toUpperCase() + name.slice(1) : name
}

/** "2 jan", a short date for a register's narrow column (Intl writes "2 jan."). */
export function shortDay(date: string): string {
  return SHORT_DAY.format(new Date(localDay(date))).replace(".", "")
}

const SHORT_DAY = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})

/** The year so far in one sentence, as the hub and the home page open with it. */
export function yearHeadline(stats: {
  speciesCount: number
  species: { name: string; first: string }[]
}): string {
  const latest = stats.species.at(-1)
  const tail = latest ? `, den senaste ${latest.name} den ${dayMonth(latest.first)}` : ""
  return `I år har ${arter(stats.speciesCount)} rapporterats i kommunen${tail}.`
}

const DAY_MONTH = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
})

/** "11 november". */
export function dayMonth(date: string): string {
  return DAY_MONTH.format(new Date(localDay(date)))
}
