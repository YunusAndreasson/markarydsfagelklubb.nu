/**
 * Shapes for the kommun's bird statistics, read from Artportalen through SLU's
 * Species Observation System (docs/roadmap.md, "Artportalen"; F6, F7).
 *
 * The scheduled jobs (`jobs.ts`) turn API records into these summaries and keep
 * them in KV; the pages only ever read the summaries. Nothing here holds the key.
 */

/** One observation as the search endpoint returns it, with only the fields we ask for. */
export type SosRecord = {
  taxon: {
    id: number
    vernacularName?: string | null
    scientificName?: string | null
    attributes?: { taxonCategory?: { id: number; value?: string } | null } | null
  }
  occurrence?: {
    occurrenceId?: string | null
    recordedBy?: string | null
    individualCount?: string | null
    url?: string | null
    activity?: { id: number; value?: string | null } | null
  } | null
  event: { startDate: string; endDate?: string | null }
  location?: { locality?: string | null } | null
}

/** One row of `Observations/TaxonAggregation`. */
export type SosTaxonAggregate = {
  taxonId: number
  observationCount: number
  firstSighting: string
  lastSighting: string
}

export type Species = { id: number; name: string; sci: string }

/** A species within one year. Dates are local (Swedish) `YYYY-MM-DD`. */
export type SpeciesYear = Species & {
  first: string
  last: string
  reports: number
  /** Reports per week of the year, 53 bins from 1 January. */
  weeks: number[]
}

export type ObserverYear = {
  name: string
  species: number
  reports: number
  /**
   * The dates on which this observer added a species to their year, sorted.
   * Kept for the top of the league only, for the race.
   */
  curve?: string[]
}

export type LocalityYear = { name: string; reports: number; species: number }

export type YearStats = {
  year: number
  fetchedAt: string
  reports: number
  /** Sum of the reported counts; rows without a number add nothing. */
  individuals: number
  speciesCount: number
  observerCount: number
  /** In order of arrival. */
  species: SpeciesYear[]
  months: { reports: number[]; species: number[] }
  /** The year's cumulative species count by day of year (index 0 = 1 January). */
  curve: number[]
  localities: LocalityYear[]
  league: ObserverYear[]
}

/** The kommun's list of everything, from one TaxonAggregation call. */
export type AllTime = {
  fetchedAt: string
  taxa: { id: number; first: string; last: string; reports: number }[]
}

/** The compact per-year line the history and the home page draw from. */
export type YearSummary = {
  year: number
  reports: number
  species: number
  observers: number
  individuals: number
  months: number[]
  /** The running species count at the end of each week bin (53), for the year's curve. */
  weeks: number[]
}

export type History = { fetchedAt: string; years: YearSummary[] }

export type Sighting = {
  id: string
  url: string | null
  speciesId: number
  name: string
  sci: string
  /** ISO start with offset, as Artportalen gives it. */
  start: string
  /** False when the report covers a whole day and has no time of its own. */
  timed: boolean
  count: number | null
  /** The count as written when it isn't a plain number, e.g. "noterad". */
  countText: string | null
  activity: string | null
  locality: string | null
  observers: string | null
}

export type Recent = { fetchedAt: string; days: number; sightings: Sighting[] }

export type Meta = {
  /** The next past year the nightly job refreshes. */
  cursor: number | null
  lastFast: string | null
  lastNightly: string | null
  lastError: string | null
}
