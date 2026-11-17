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

/** Dyntaxa's taxon category "Art". */
export const SPECIES_CATEGORY = 17
/**
 * The ranks below a species that count as it, the way Artportalen's own
 * species lists count them: Underart (gråkråka is kråka), Population (tamduva
 * is klippduva) and Morfotyp (a white jaktfalk). Hybrids, genera, families and
 * "a or b" complexes name no one species, so they count for none.
 */
export const BELOW_SPECIES = [18, 23, 32] as const
/** What the jobs ask Artportalen for. */
export const COUNTED_CATEGORIES = [SPECIES_CATEGORY, ...BELOW_SPECIES]

export const LEAGUE_CURVES = 20
/** A year with at most this many reports of a species keeps their days (`SpeciesYear.days`). */
export const SPARSE_REPORTS = 10
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

/**
 * The species a record counts for: its own taxon, or a subspecies' or
 * population's parent. Null for a rank that names no single species.
 */
export function speciesIdOf(record: SosRecord): number | null {
  const attributes = record.taxon.attributes
  const category = attributes?.taxonCategory?.id
  // The jobs filter on the server; an absent category means it was already filtered.
  if (category === undefined || category === SPECIES_CATEGORY) return record.taxon.id
  if ((BELOW_SPECIES as readonly number[]).includes(category)) {
    return attributes?.parentDyntaxaTaxonId ?? null
  }
  return null
}

const isOwnSpecies = (record: SosRecord) => speciesIdOf(record) === record.taxon.id

function ownName(record: SosRecord): Species {
  return {
    id: record.taxon.id,
    name:
      record.taxon.vernacularName?.trim() ||
      record.taxon.scientificName?.trim() ||
      `taxon ${record.taxon.id}`,
    sci: record.taxon.scientificName?.trim() ?? "",
  }
}

/**
 * Names for every species the records count for. A species-rank record names
 * itself; a subspecies' species takes its name from one of those in the same
 * batch, else from `names`. `unnamedSpecies` says which still need a lookup.
 */
export function speciesNames(
  records: readonly SosRecord[],
  names: NameMap | null
): Map<number, Species> {
  const out = new Map<number, Species>()
  for (const record of records) {
    if (isOwnSpecies(record) && !out.has(record.taxon.id)) {
      out.set(record.taxon.id, ownName(record))
    }
  }
  for (const record of records) {
    const id = speciesIdOf(record)
    if (id === null || out.has(id)) continue
    const known = names?.[id]
    if (known) out.set(id, { id, ...known })
  }
  return out
}

/** The species the records count for that neither they nor `names` can name. */
export function unnamedSpecies(records: readonly SosRecord[], names: NameMap | null): number[] {
  const named = speciesNames(records, names)
  const ids = new Set<number>()
  for (const record of records) {
    const id = speciesIdOf(record)
    if (id !== null && !named.has(id)) ids.add(id)
  }
  return [...ids]
}

function speciesOf(record: SosRecord, named: Map<number, Species>): Species | null {
  const id = speciesIdOf(record)
  if (id === null) return null
  return (
    named.get(id) ??
    (id === record.taxon.id ? ownName(record) : { id, name: `taxon ${id}`, sci: "" })
  )
}

/** A report before this day of the year (1 March) can be a bird that wintered. */
export const WINTER_UNTIL = 60
/** …when nothing else is reported for this many days after it. */
export const WINTER_GAP_DAYS = 21

/**
 * The year's spring arrival from its sorted report dates. A summer bird that
 * wintered (a trana on Hammarsjön in January) gives a report or two, then
 * weeks of nothing until the others come: the arrival is the report after the
 * last such gap that starts in winter. Without one it is the first report.
 */
export function springArrival(dates: readonly string[]): string | undefined {
  let arrival = dates[0]
  for (let i = 0; i < dates.length - 1; i++) {
    const day = dayOfYear(dates[i] as string)
    if (day >= WINTER_UNTIL) break
    if (dayOfYear(dates[i + 1] as string) - day >= WINTER_GAP_DAYS) arrival = dates[i + 1]
  }
  return arrival
}

const sv = new Intl.Collator("sv")

export function aggregateYear(
  year: number,
  records: readonly SosRecord[],
  fetchedAt: string,
  names: NameMap | null = null
): YearStats {
  const named = speciesNames(records, names)
  const dates = new Map<number, Set<string>>()
  const species = new Map<number, SpeciesYear>()
  const observers = new Map<string, { reports: number; firsts: Map<number, string> }>()
  const localities = new Map<string, { reports: number; species: Set<number> }>()
  const monthReports = new Array<number>(12).fill(0)
  const monthSpecies = Array.from({ length: 12 }, () => new Set<number>())
  let reports = 0
  let individuals = 0

  for (const record of records) {
    const counted = speciesOf(record, named)
    if (!counted) continue
    const date = localDate(record.event.startDate)
    if (Number(date.slice(0, 4)) !== year) continue
    reports++
    individuals += parseCount(record.occurrence?.individualCount) ?? 0

    const { id, name, sci } = counted
    let days = dates.get(id)
    if (!days) {
      days = new Set()
      dates.set(id, days)
    }
    days.add(date)
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

  for (const one of species.values()) {
    const days = [...(dates.get(one.id) ?? [])].sort()
    const arrival = springArrival(days)
    if (arrival && arrival !== one.first) one.arrival = arrival
    if (one.reports <= SPARSE_REPORTS) one.days = days
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

/**
 * One record for "Senaste fynden". A subspecies is listed as its species, so
 * the list counts and links the way the species pages do. Null for a record
 * that counts for no single species.
 */
export function toSighting(
  record: SosRecord,
  named: Map<number, Species> = new Map()
): Sighting | null {
  const species = speciesOf(record, named)
  if (!species) return null
  const { id, name, sci } = species
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
    position: positionOf(record),
  }
}

/** A report's coordinates, or null when it has none that are numbers. */
function positionOf(record: SosRecord): Sighting["position"] {
  const latitude = record.location?.decimalLatitude
  const longitude = record.location?.decimalLongitude
  if (typeof latitude !== "number" || typeof longitude !== "number") return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  const metres = record.location?.coordinateUncertaintyInMeters
  return { latitude, longitude, metres: typeof metres === "number" ? metres : null }
}

/** Only links back to Artportalen itself, over https, are kept. */
export function safeArtportalenUrl(url: string | null | undefined): string | null {
  if (!url || !URL.canParse(url)) return null
  const parsed = new URL(url)
  return parsed.protocol === "https:" && parsed.origin === "https://www.artportalen.se"
    ? parsed.href
    : null
}
