import { dayOfYear } from "./aggregate"
import type {
  AllTime,
  PastDay,
  PastMonth,
  Season,
  SeasonTaxon,
  TaxonEntry,
  TaxonIndex,
  TaxonYear,
  YearStats,
} from "./types"

/**
 * Each taxon's history across the years (docs/design.md, "Arter"), kept in one
 * KV key so a species page and the season block read one value instead of
 * forty year keys.
 *
 * The jobs merge a year into it whenever they refresh that year
 * (`refreshYear` in `jobs.ts`), the same way they merge the year's summary
 * into `history`: a year replaces itself, so refreshing it twice changes
 * nothing.
 */

/** How many recent years "usually" looks back over. */
export const SEASON_WINDOW = 20
/** A taxon seen in fewer of those years has no "usually": it's a visitor, not a season. */
export const SEASON_MIN_YEARS = 8
/** A last sighting from this day on means it never left. */
const STILL_HERE_FROM = 352
/**
 * A summer bird whose last reports usually come before this day (1 August)
 * has not left: it has stopped singing (ärtsångare's fall silent in late June).
 * Its departure is unknown rather than wrong, so it gets none.
 */
export const LEAVES_FROM = 213

/** The year's non-empty week bins, as `[week, reports]`. */
export function sparseWeeks(weeks: readonly number[]): [number, number][] {
  const out: [number, number][] = []
  weeks.forEach((count, week) => {
    if (count > 0) out.push([week, count])
  })
  return out
}

const monthDay = (date: string) => date.slice(5, 10)

/** Merge one year's species into the index, replacing whatever that year said before. */
export function mergeTaxa(
  index: TaxonIndex | null,
  stats: YearStats,
  fetchedAt: string
): TaxonIndex {
  const key = String(stats.year)
  const taxa: Record<string, TaxonEntry> = {}
  for (const [id, entry] of Object.entries(index?.taxa ?? {})) {
    const { [key]: _replaced, ...years } = entry.years
    if (Object.keys(years).length > 0) taxa[id] = { ...entry, years }
  }

  for (const one of stats.species) {
    const year: TaxonYear = {
      f: monthDay(one.first),
      l: monthDay(one.last),
      ...(one.arrival ? { a: monthDay(one.arrival) } : {}),
      r: one.reports,
      w: sparseWeeks(one.weeks),
      ...(one.days ? { d: one.days.map(monthDay) } : {}),
    }
    const existing = taxa[one.id]
    const newest = existing ? Math.max(...Object.keys(existing.years).map(Number)) : -Infinity
    // The newest year names the taxon: Artportalen's names change with taxonomy.
    const names = stats.year >= newest ? { name: one.name, sci: one.sci } : existing
    taxa[one.id] = {
      name: names?.name ?? one.name,
      sci: names?.sci ?? one.sci,
      years: { ...(existing?.years ?? {}), [key]: year },
    }
  }

  const years = (index?.years ?? []).filter((year) => year !== stats.year)
  if (stats.reports > 0) years.push(stats.year)
  years.sort((a, b) => a - b)
  return { fetchedAt, years, taxa }
}

/** The whole index from scratch, from every stored year (the one-time backfill). */
export function rebuildTaxa(years: readonly YearStats[], fetchedAt: string): TaxonIndex {
  let index: TaxonIndex | null = null
  for (const stats of [...years].sort((a, b) => a.year - b.year)) {
    index = mergeTaxa(index, stats, fetchedAt)
  }
  return index ?? { fetchedAt, years: [], taxa: {} }
}

/** True when the index is missing a year that the history has: time to rebuild. */
export function needsRebuild(index: TaxonIndex | null, historyYears: readonly number[]): boolean {
  if (!index) return historyYears.length > 0
  const have = new Set(index.years)
  return historyYears.some((year) => !have.has(year))
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : Math.round(((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2)
}

/**
 * The years "usually" is measured over: the last {@link SEASON_WINDOW} years
 * with any data, never the current one, which is still being written.
 */
export function seasonWindow(indexYears: readonly number[], thisYear: number): number[] {
  return indexYears.filter((year) => year < thisYear).slice(-SEASON_WINDOW)
}

/**
 * "summer": arrives in spring and leaves in autumn (gök). "winter": a winter
 * guest, here when the year begins, gone in summer, back in autumn (sädgås);
 * its arrival is the autumn return and its departure the spring leaving.
 */
export type SeasonKind = "summer" | "winter"

export type Typical = {
  arrival: number | null
  departure: number | null
  kind: SeasonKind | null
  years: number
}

/** A summer gap at least this long, in week bins, makes a winter guest. */
const GAP_WEEKS = 8
/** The gap's middle has to fall in summer: between mid-April and early October. */
const GAP_MIDDLE_FROM = 15
const GAP_MIDDLE_TO = 40

/**
 * The longest run of empty weeks in one year with the bird seen on both sides
 * of it, when it is long enough and falls in summer: the weeks it left and
 * came back. Null for a bird with no such gap.
 */
export function summerGap(
  weeks: readonly [number, number][]
): { left: number; back: number } | null {
  const present = weeks.map(([week]) => week).sort((a, b) => a - b)
  let best: { left: number; back: number } | null = null
  for (let i = 1; i < present.length; i++) {
    const left = present[i - 1] as number
    const back = present[i] as number
    const gap = back - left - 1
    const middle = (left + back) / 2
    if (gap < GAP_WEEKS || middle < GAP_MIDDLE_FROM || middle > GAP_MIDDLE_TO) continue
    if (!best || gap > best.back - best.left - 1) best = { left, back }
  }
  return best
}

/** The middle day of a week bin, as a 1-based day of the year. */
const dayOfWeek = (week: number) => week * 7 + 4

/**
 * When a taxon usually arrives and leaves, as a 1-based day of the year.
 *
 * The median over the window, so one freak early bird doesn't move it. A
 * summer bird's first and last report of the year; a winter guest's autumn
 * return and spring leaving, read off the summer gap in its weekly reports.
 * Nothing for a resident, nor for a bird seen in too few of the years to have
 * a season at all.
 */
export function typicalDays(entry: TaxonEntry, window: readonly number[]): Typical {
  const seen = window.map((year) => ({ year, data: entry.years[year] })).filter((one) => one.data)
  const none = { arrival: null, departure: null, kind: null, years: seen.length }
  if (seen.length < SEASON_MIN_YEARS) return none

  const kind = seasonKind(entry, window)
  const mostly = (count: number) => count > seen.length / 2

  if (kind === "summer") {
    const firsts = seen.map(({ year, data }) => dayOfYear(`${year}-${data?.a ?? data?.f}`))
    const lasts = seen.map(({ year, data }) => dayOfYear(`${year}-${data?.l}`))
    const arrival = median(firsts)
    const leaves = mostly(lasts.filter((day) => day >= STILL_HERE_FROM).length)
      ? null
      : median(lasts)
    return {
      arrival,
      departure: leaves !== null && leaves > arrival && leaves >= LEAVES_FROM ? leaves : null,
      kind,
      years: seen.length,
    }
  }

  if (kind === "winter") {
    const gaps = seen.flatMap(({ data }) => {
      const gap = data ? summerGap(data.w) : null
      return gap ? [gap] : []
    })
    if (!mostly(gaps.length)) return none
    return {
      arrival: dayOfWeek(median(gaps.map((gap) => gap.back))),
      departure: dayOfWeek(median(gaps.map((gap) => gap.left))),
      kind,
      years: seen.length,
    }
  }

  return none
}

/** Too few reports over the window to say which kind of bird it is. */
const MIN_REPORTS = 30
/** A summer bird: at most this share of its reports fall in winter (weeks 0–7, 47–52). */
const SUMMER_MAX_WINTER_SHARE = 0.03
/** A winter guest: at most this share fall in high summer (weeks 22–33). */
const WINTER_MAX_SUMMER_SHARE = 0.015

/**
 * Which kind of bird it is, from where its reports fall over the twenty
 * years together. Per-year first and last dates can't tell this alone: a
 * resident few people report until March looks like a spring arrival, and one
 * whose summer reports thin out looks like it leaves. Measured on the live
 * data on 2026-11-14: gök, ladusvala and trana come out summer birds;
 * bergfink, sidensvans, gråsiska and storskrake winter guests; blåmes,
 * kattuggla, tjäder and koltrast residents, with no season at all.
 */
export function seasonKind(entry: TaxonEntry, window: readonly number[]): SeasonKind | null {
  const weeks = windowWeeks(entry, window)
  const total = weeks.reduce((sum, one) => sum + one, 0)
  if (total < MIN_REPORTS) return null
  const share = (from: number, to: number) =>
    weeks.slice(from, to + 1).reduce((sum, one) => sum + one, 0) / total
  if (share(0, 7) + share(47, 52) <= SUMMER_MAX_WINTER_SHARE) return "summer"
  if (share(22, 33) <= WINTER_MAX_SUMMER_SHARE) return "winter"
  return null
}

/** The small key the home page reads: every taxon with a season. */
export function buildSeason(index: TaxonIndex, thisYear: number, fetchedAt: string): Season {
  const window = seasonWindow(index.years, thisYear)
  const taxa: SeasonTaxon[] = []
  for (const [id, entry] of Object.entries(index.taxa)) {
    const { arrival, departure, kind } = typicalDays(entry, window)
    if (kind === null || (arrival === null && departure === null)) continue
    taxa.push({ id: Number(id), name: entry.name, sci: entry.sci, arrival, departure, kind })
  }
  taxa.sort((a, b) => a.name.localeCompare(b.name, "sv"))
  return { fetchedAt, taxa }
}

/** Reports per week bin over the window's years: a bird's usual year, as its season is read. */
export function windowWeeks(entry: TaxonEntry, window: readonly number[]): number[] {
  const weeks = Array.from({ length: 53 }, () => 0)
  for (const year of window) {
    for (const [week, count] of entry.years[year]?.w ?? []) weeks[week] = (weeks[week] ?? 0) + count
  }
  return weeks
}

/** Reports per week bin over every year, for the "över året" figure. */
export function weeksTotal(entry: TaxonEntry): number[] {
  const weeks = Array.from({ length: 53 }, () => 0)
  for (const year of Object.values(entry.years)) {
    for (const [week, count] of year.w) weeks[week] = (weeks[week] ?? 0) + count
  }
  return weeks
}

/**
 * The spring arrival per year, oldest first, as 1-based days of the year: the
 * first report, unless that was a bird that wintered (`springArrival`).
 */
export function arrivals(entry: TaxonEntry): { year: number; day: number }[] {
  return Object.entries(entry.years)
    .map(([year, data]) => ({ year: Number(year), day: dayOfYear(`${year}-${data.a ?? data.f}`) }))
    .sort((a, b) => a.year - b.year)
}

/**
 * The kommun's list of everything, from the per-taxon index: first and last
 * report and the count. Built from the years rather than asked of
 * Artportalen, whose aggregation keeps a subspecies apart from its species
 * (gråkråka's 1 185 reports would be missing from kråka).
 */
export function allTimeFromIndex(index: TaxonIndex, fetchedAt: string): AllTime {
  const taxa = Object.entries(index.taxa).flatMap(([id, entry]) => {
    const years = Object.keys(entry.years)
      .map(Number)
      .sort((a, b) => a - b)
    const first = years[0]
    const last = years.at(-1)
    if (first === undefined || last === undefined) return []
    return [
      {
        id: Number(id),
        first: `${first}-${entry.years[first]?.f}`,
        last: `${last}-${entry.years[last]?.l}`,
        reports: Object.values(entry.years).reduce((sum, one) => sum + one.r, 0),
      },
    ]
  })
  taxa.sort((a, b) => b.reports - a.reports || a.id - b.id)
  return { fetchedAt, taxa }
}

/**
 * The twelve month keys "I backspegeln" reads (`ap:v1:past:MM`), from the sparse
 * days in the index. Every year is in them, this one too: the page leaves out
 * the current year itself, so the keys need no rebuild on New Year's night.
 */
export function buildPast(index: TaxonIndex, fetchedAt: string): PastMonth[] {
  const months: PastMonth[] = Array.from({ length: 12 }, (_, i) => ({
    fetchedAt,
    month: i + 1,
    days: [],
    names: {},
  }))
  for (const [id, entry] of Object.entries(index.taxa)) {
    for (const [year, data] of Object.entries(entry.years)) {
      for (const day of data.d ?? []) {
        const month = months[Number(day.slice(0, 2)) - 1]
        if (!month) continue
        month.days.push([Number(id), Number(year), day, data.r] satisfies PastDay)
        month.names[id] = { name: entry.name, sci: entry.sci }
      }
    }
  }
  for (const month of months) {
    month.days.sort((a, b) => a[2].localeCompare(b[2]) || a[1] - b[1] || a[0] - b[0])
  }
  return months
}
