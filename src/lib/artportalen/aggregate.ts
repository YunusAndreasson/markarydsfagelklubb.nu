import type {
  History,
  LocalityYear,
  ObserverYear,
  Sighting,
  SosRecord,
  Species,
  SpeciesYear,
  YearStats,
  YearSummary,
} from "./types"

/**
 * Pure: API records in, the summaries the pages draw from out. No I/O, so the
 * tests feed it synthetic records and the jobs feed it the API's.
 */

/** Dyntaxa's taxon category "Art". Subspecies, hybrids and "obestämd" rows are other categories. */
export const SPECIES_CATEGORY = 17

/** How many of the league get a race curve; the rest only a total. */
export const LEAGUE_CURVES = 20
export const TOP_LOCALITIES = 15

/**
 * Artportalen writes local time with an offset ("2026-01-13T10:00:00+01:00"),
 * so the date part is already the Swedish date.
 */
export function localDate(iso: string): string {
  return iso.slice(0, 10)
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365
}

/** 1-based day of year for a `YYYY-MM-DD` date. */
export function dayOfYear(date: string): number {
  const [y, m, d] = date.split("-").map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1
}

/** Week bins from 1 January, 0–52. Not ISO weeks, which straddle years. */
export function weekIndex(date: string): number {
  return Math.min(52, Math.floor((dayOfYear(date) - 1) / 7))
}

/** "3", "12" → a number; "", "noterad", "ca 20" → null. */
export function parseCount(text: string | null | undefined): number | null {
  if (!text) return null
  const trimmed = text.trim()
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null
}

/** A sighting can name several observers, comma-separated; each gets the credit. */
export function splitObservers(text: string | null | undefined): string[] {
  if (!text) return []
  return [
    ...new Set(
      text
        .split(",")
        .map((name) => name.trim().replace(/\s+/g, " "))
        .filter(Boolean)
    ),
  ]
}

export function isSpecies(record: SosRecord): boolean {
  const category = record.taxon.attributes?.taxonCategory?.id
  // The jobs filter on the server; an absent category means it was already filtered.
  return category === undefined || category === SPECIES_CATEGORY
}

function speciesOf(record: SosRecord): Species {
  return {
    id: record.taxon.id,
    name:
      record.taxon.vernacularName?.trim() ||
      record.taxon.scientificName?.trim() ||
      `taxon ${record.taxon.id}`,
    sci: record.taxon.scientificName?.trim() ?? "",
  }
}

const sv = new Intl.Collator("sv")

export function aggregateYear(
  year: number,
  records: readonly SosRecord[],
  fetchedAt: string
): YearStats {
  const species = new Map<number, SpeciesYear>()
  const observers = new Map<string, { reports: number; firsts: Map<number, string> }>()
  const localities = new Map<string, { reports: number; species: Set<number> }>()
  const monthReports = new Array<number>(12).fill(0)
  const monthSpecies = Array.from({ length: 12 }, () => new Set<number>())
  let reports = 0
  let individuals = 0

  for (const record of records) {
    if (!isSpecies(record)) continue
    const date = localDate(record.event.startDate)
    if (Number(date.slice(0, 4)) !== year) continue
    reports++
    individuals += parseCount(record.occurrence?.individualCount) ?? 0

    const { id, name, sci } = speciesOf(record)
    let entry = species.get(id)
    if (!entry) {
      entry = {
        id,
        name,
        sci,
        first: date,
        last: date,
        reports: 0,
        weeks: new Array<number>(53).fill(0),
      }
      species.set(id, entry)
    }
    entry.reports++
    entry.weeks[weekIndex(date)]++
    if (date < entry.first) entry.first = date
    if (date > entry.last) entry.last = date

    const month = Number(date.slice(5, 7)) - 1
    monthReports[month]++
    monthSpecies[month].add(id)

    for (const observer of splitObservers(record.occurrence?.recordedBy)) {
      let person = observers.get(observer)
      if (!person) {
        person = { reports: 0, firsts: new Map() }
        observers.set(observer, person)
      }
      person.reports++
      const seen = person.firsts.get(id)
      if (!seen || date < seen) person.firsts.set(id, date)
    }

    const locality = record.location?.locality?.trim()
    if (locality) {
      let place = localities.get(locality)
      if (!place) {
        place = { reports: 0, species: new Set() }
        localities.set(locality, place)
      }
      place.reports++
      place.species.add(id)
    }
  }

  const arrivals = [...species.values()].sort(
    (a, b) => a.first.localeCompare(b.first) || sv.compare(a.name, b.name)
  )

  const curve = new Array<number>(daysInYear(year)).fill(0)
  for (const one of arrivals) curve[dayOfYear(one.first) - 1]++
  for (let day = 1; day < curve.length; day++) curve[day] += curve[day - 1]

  const league: ObserverYear[] = [...observers]
    .map(([name, person]) => ({
      name,
      species: person.firsts.size,
      reports: person.reports,
      firsts: person.firsts,
    }))
    .sort((a, b) => b.species - a.species || b.reports - a.reports || sv.compare(a.name, b.name))
    .map(({ firsts, ...person }, rank) =>
      rank < LEAGUE_CURVES ? { ...person, curve: [...firsts.values()].sort() } : person
    )

  const topLocalities: LocalityYear[] = [...localities]
    .map(([name, place]) => ({ name, reports: place.reports, species: place.species.size }))
    .sort((a, b) => b.reports - a.reports || sv.compare(a.name, b.name))
    .slice(0, TOP_LOCALITIES)

  return {
    year,
    fetchedAt,
    reports,
    individuals,
    speciesCount: arrivals.length,
    observerCount: observers.size,
    species: arrivals,
    months: { reports: monthReports, species: monthSpecies.map((set) => set.size) },
    curve,
    localities: topLocalities,
    league,
  }
}

export function summarise(stats: YearStats): YearSummary {
  return {
    year: stats.year,
    reports: stats.reports,
    species: stats.speciesCount,
    observers: stats.observerCount,
    individuals: stats.individuals,
    months: stats.months.reports,
    weeks: Array.from(
      { length: 53 },
      (_, week) => stats.curve[Math.min(stats.curve.length - 1, week * 7 + 6)] ?? 0
    ),
  }
}

/** Replaces one year's line, keeping the rest; years with no reports drop out. */
export function mergeHistory(
  history: History | null,
  summary: YearSummary,
  fetchedAt: string
): History {
  const years = (history?.years ?? []).filter((one) => one.year !== summary.year)
  if (summary.reports > 0) years.push(summary)
  years.sort((a, b) => a.year - b.year)
  return { fetchedAt, years }
}

/** taxon id → names, grown by every year scanned, so the all-time list can name its taxa. */
export type NameMap = Record<string, { name: string; sci: string }>

export function mergeNames(names: NameMap | null, species: readonly Species[]): NameMap {
  const next: NameMap = { ...(names ?? {}) }
  for (const one of species) next[one.id] = { name: one.name, sci: one.sci }
  return next
}

export function toSighting(record: SosRecord): Sighting {
  const { id, name, sci } = speciesOf(record)
  const countText = record.occurrence?.individualCount?.trim() || null
  const count = parseCount(countText)
  const start = record.event.startDate
  const end = record.event.endDate ?? ""
  // A report without a time spans the whole day: 00:00 to 23:59:59.
  const timed = !(start.slice(11, 16) === "00:00" && end.slice(11, 16) === "23:59")
  return {
    id: record.occurrence?.occurrenceId ?? `${id}-${start}`,
    url: safeArtportalenUrl(record.occurrence?.url),
    speciesId: id,
    name,
    sci,
    start,
    timed,
    count,
    countText: count === null ? countText : null,
    activity: record.occurrence?.activity?.value?.trim() || null,
    locality: record.location?.locality?.trim() || null,
    observers: splitObservers(record.occurrence?.recordedBy).join(", ") || null,
  }
}

/** Only links back to Artportalen itself, over https, are kept. */
export function safeArtportalenUrl(url: string | null | undefined): string | null {
  if (!url || !URL.canParse(url)) return null
  const parsed = new URL(url)
  return parsed.protocol === "https:" && parsed.origin === "https://www.artportalen.se"
    ? parsed.href
    : null
}
