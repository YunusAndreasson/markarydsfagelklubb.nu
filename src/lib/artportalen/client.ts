import { createFetchWithTimeout } from "@/lib/fetch"
import { COUNTED_CATEGORIES, SPECIES_CATEGORY } from "./aggregate"
import type { SosRecord, SosTaxonAggregate } from "./types"

/**
 * SLU's Species Observation System, the API behind Artportalen's open data
 * (docs/roadmap.md, "Artportalen"). The only module that holds the
 * subscription key, which `artportalen-key-scope.test.ts` checks. Only the
 * scheduled jobs call it; no page waits on Artportalen.
 */

const API = "https://api.artdatabanken.se/species-observation-system/v1"
const PAGE_SIZE = 1000
/** The search endpoint's hard limit; a single year of the kommun is well under it (4 420 at most). */
export const SEARCH_CAP = 10_000

/**
 * Markaryds kommun (kommunkod 0767), birds (Aves), Artportalen only: species,
 * and the subspecies, populations and morphs that `aggregate.ts` counts as them.
 */
export const KOMMUN_FILTER = {
  dataProvider: { ids: [1] },
  taxon: { ids: [4000104], includeUnderlyingTaxa: true, taxonCategories: COUNTED_CATEGORIES },
  geographics: { areas: [{ areaType: "Municipality", featureId: "767" }] },
} as const

/** Asking for fields explicitly keeps the response small and the record shape known. */
const YEAR_FIELDS = [
  "taxon.id",
  "taxon.vernacularName",
  "taxon.scientificName",
  "taxon.attributes.taxonCategory",
  "taxon.attributes.parentDyntaxaTaxonId",
  "occurrence.recordedBy",
  "occurrence.individualCount",
  "event.startDate",
  "location.locality",
]

const RECENT_FIELDS = [
  ...YEAR_FIELDS,
  "occurrence.occurrenceId",
  "occurrence.url",
  "occurrence.activity",
  "event.endDate",
]

/** Artportalen said "slow down". The job stops and the next run carries on. */
export class RateLimited extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(`Artportalen rate limit, retry in ${retryAfterSeconds}s`)
  }
}

export class SosError extends Error {}

export type Client = ReturnType<typeof createClient>

export function createClient(
  apiKey: string,
  fetchImpl: typeof fetch = createFetchWithTimeout(30_000)
) {
  let calls = 0

  async function post<T>(path: string, body: unknown): Promise<T> {
    calls++
    const response = await fetchImpl(`${API}${path}`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (response.status === 429) {
      const text = await response.text()
      throw new RateLimited(Number(/(\d+) seconds/.exec(text)?.[1] ?? 60))
    }
    if (!response.ok) {
      throw new SosError(
        `SOS ${path} answered ${response.status}: ${(await response.text()).slice(0, 200)}`
      )
    }
    return (await response.json()) as T
  }

  /** Every record matching the filter, paged; refuses to silently truncate at the cap. */
  async function searchAll(filter: object, fields: string[], query = ""): Promise<SosRecord[]> {
    const records: SosRecord[] = []
    let total = 0
    do {
      const page = await post<{ totalCount: number; records: SosRecord[] }>(
        `/Observations/Search?skip=${records.length}&take=${PAGE_SIZE}&translationCultureCode=sv-SE${query}`,
        { ...filter, output: { fields } }
      )
      total = page.totalCount
      if (total > SEARCH_CAP)
        throw new SosError(`${total} records is over the search cap of ${SEARCH_CAP}`)
      if (page.records.length === 0) break
      records.push(...page.records)
    } while (records.length < total)
    return records
  }

  const range = (startDate: string, endDate: string) => ({
    date: { startDate, endDate, dateFilterType: "OverlappingStartDateAndEndDate" },
  })

  return {
    get calls() {
      return calls
    },

    /** Every bird record in the kommun for one calendar year. */
    year(year: number): Promise<SosRecord[]> {
      return searchAll(
        { ...KOMMUN_FILTER, ...range(`${year}-01-01`, `${year}-12-31`) },
        YEAR_FIELDS
      )
    },

    /** The newest records, newest first. */
    recent(from: string, to: string): Promise<SosRecord[]> {
      return searchAll(
        { ...KOMMUN_FILTER, ...range(from, to) },
        RECENT_FIELDS,
        "&sortBy=event.startDate&sortOrder=Desc"
      )
    },

    /**
     * One row per taxon ever recorded in the kommun, a subspecies apart from
     * its species. The jobs only read how far back it goes: the all-time list
     * itself is built from the years (`allTimeFromIndex`), which count each
     * subspecies as its species.
     */
    async allTime(): Promise<SosTaxonAggregate[]> {
      const body = await post<SosTaxonAggregate[] | { records: SosTaxonAggregate[] }>(
        "/Observations/TaxonAggregation",
        KOMMUN_FILTER
      )
      return Array.isArray(body) ? body : body.records
    },

    /**
     * A species' own name, from one species-rank record anywhere in Sweden:
     * a species reported in the kommun only as a subspecies has none here.
     */
    async nameOf(taxonId: number): Promise<SosRecord | null> {
      const page = await post<{ records: SosRecord[] }>(
        "/Observations/Search?skip=0&take=1&translationCultureCode=sv-SE",
        {
          dataProvider: KOMMUN_FILTER.dataProvider,
          taxon: { ids: [taxonId], taxonCategories: [SPECIES_CATEGORY] },
          output: { fields: ["taxon.id", "taxon.vernacularName", "taxon.scientificName"] },
        }
      )
      return page.records[0] ?? null
    },
  }
}
