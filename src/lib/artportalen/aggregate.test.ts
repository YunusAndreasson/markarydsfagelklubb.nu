import { describe, expect, it } from "vitest"
import {
  aggregateYear,
  dayOfYear,
  mergeHistory,
  mergeNames,
  parseCount,
  safeArtportalenUrl,
  splitObservers,
  summarise,
  toSighting,
  weekIndex,
} from "./aggregate"
import type { SosRecord } from "./types"

const FETCHED = "2026-11-14T12:00:00.000Z"

function record(
  date: string,
  taxon: [number, string, string],
  extra: { by?: string; count?: string; place?: string; category?: number; time?: string } = {}
): SosRecord {
  return {
    taxon: {
      id: taxon[0],
      vernacularName: taxon[1],
      scientificName: taxon[2],
      attributes:
        extra.category === undefined ? undefined : { taxonCategory: { id: extra.category } },
    },
    occurrence: { recordedBy: extra.by ?? "Anna A", individualCount: extra.count ?? "1" },
    event: { startDate: `${date}T${extra.time ?? "08:00"}:00+01:00` },
    location: { locality: extra.place ?? "Exempelsjön, Sm" },
  }
}

const KOLTRAST: [number, string, string] = [1, "koltrast", "Turdus merula"]
const TRANA: [number, string, string] = [2, "trana", "Grus grus"]
const PRUTGAS: [number, string, string] = [3, "prutgås", "Branta bernicla"]

describe("dates", () => {
  it("counts days and weeks from 1 January", () => {
    expect(dayOfYear("2026-01-01")).toBe(1)
    expect(dayOfYear("2026-12-31")).toBe(365)
    expect(dayOfYear("2024-12-31")).toBe(366)
    expect(weekIndex("2026-01-07")).toBe(0)
    expect(weekIndex("2026-01-08")).toBe(1)
    expect(weekIndex("2024-12-31")).toBe(52)
  })
})

describe("parseCount and splitObservers", () => {
  it("takes plain numbers only", () => {
    expect(parseCount("12")).toBe(12)
    expect(parseCount(" 3 ")).toBe(3)
    expect(parseCount("noterad")).toBeNull()
    expect(parseCount("")).toBeNull()
    expect(parseCount(null)).toBeNull()
  })

  it("credits every co-observer once", () => {
    expect(splitObservers("Anna A, Bo  B,Anna A")).toEqual(["Anna A", "Bo B"])
    expect(splitObservers(null)).toEqual([])
  })
})

describe("aggregateYear", () => {
  const records = [
    record("2026-03-20", TRANA, { by: "Bo B, Anna A", count: "40", place: "Mossen, Sm" }),
    record("2026-01-02", KOLTRAST, { count: "2" }),
    record("2026-01-05", KOLTRAST, { by: "Bo B", count: "noterad" }),
    record("2026-11-11", PRUTGAS, { by: "Cia C" }),
    // A subspecies row and a row from another year are left out.
    record("2026-05-01", [4, "gråtrut (ssp)", "Larus argentatus argenteus"], { category: 18 }),
    record("2025-12-31", PRUTGAS),
  ]
  const stats = aggregateYear(2026, records, FETCHED)

  it("counts species in order of arrival", () => {
    expect(stats.speciesCount).toBe(3)
    expect(stats.species.map((one) => one.name)).toEqual(["koltrast", "trana", "prutgås"])
    expect(stats.species[0]).toMatchObject({ first: "2026-01-02", last: "2026-01-05", reports: 2 })
  })

  it("sums reports and only numeric counts", () => {
    expect(stats.reports).toBe(4)
    expect(stats.individuals).toBe(43)
  })

  it("builds the month and week tallies", () => {
    expect(stats.months.reports[0]).toBe(2)
    expect(stats.months.reports[2]).toBe(1)
    expect(stats.months.species[0]).toBe(1)
    expect(stats.species[0].weeks[0]).toBe(2)
  })

  it("keeps a cumulative species curve over the whole year", () => {
    expect(stats.curve).toHaveLength(365)
    expect(stats.curve[0]).toBe(0)
    expect(stats.curve[1]).toBe(1)
    expect(stats.curve[dayOfYear("2026-03-20") - 1]).toBe(2)
    expect(stats.curve.at(-1)).toBe(3)
  })

  it("ranks the league by species, then reports, with race curves", () => {
    expect(stats.observerCount).toBe(3)
    expect(stats.league.map((one) => [one.name, one.species, one.reports])).toEqual([
      ["Anna A", 2, 2],
      ["Bo B", 2, 2],
      ["Cia C", 1, 1],
    ])
    expect(stats.league[0].curve).toEqual(["2026-01-02", "2026-03-20"])
  })

  it("lists the busiest localities", () => {
    expect(stats.localities[0]).toEqual({ name: "Exempelsjön, Sm", reports: 3, species: 2 })
  })

  it("summarises into the history", () => {
    const summary = summarise(stats)
    expect(summary).toMatchObject({
      year: 2026,
      reports: 4,
      species: 3,
      observers: 3,
      individuals: 43,
    })
    const history = mergeHistory(
      {
        fetchedAt: FETCHED,
        years: [
          { ...summary, year: 2026, reports: 1 },
          { ...summary, year: 1990 },
        ],
      },
      summary,
      FETCHED
    )
    expect(history.years.map((one) => [one.year, one.reports])).toEqual([
      [1990, 4],
      [2026, 4],
    ])
    expect(
      mergeHistory(history, { ...summary, year: 1990, reports: 0 }, FETCHED).years
    ).toHaveLength(1)
  })

  it("grows the name map", () => {
    expect(mergeNames({ "9": { name: "x", sci: "y" } }, stats.species)).toMatchObject({
      "1": { name: "koltrast", sci: "Turdus merula" },
      "9": { name: "x", sci: "y" },
    })
  })
})

describe("toSighting", () => {
  it("marks whole-day reports as untimed and keeps a written count", () => {
    const one = toSighting({
      ...record("2026-11-12", KOLTRAST, { count: "noterad", time: "00:00" }),
      event: { startDate: "2026-11-12T00:00:00+01:00", endDate: "2026-11-12T23:59:59+01:00" },
    })
    expect(one).toMatchObject({ timed: false, count: null, countText: "noterad", name: "koltrast" })
    expect(toSighting(record("2026-11-12", KOLTRAST, { count: "4" }))).toMatchObject({
      timed: true,
      count: 4,
      countText: null,
    })
  })

  it("keeps only Artportalen's own https links", () => {
    expect(safeArtportalenUrl("https://www.artportalen.se/sighting/1")).toBe(
      "https://www.artportalen.se/sighting/1"
    )
    expect(safeArtportalenUrl("http://www.artportalen.se/sighting/1")).toBeNull()
    expect(safeArtportalenUrl("https://www.artportalen.se.evil.example/x")).toBeNull()
    expect(safeArtportalenUrl("javascript:alert(1)")).toBeNull()
  })
})
