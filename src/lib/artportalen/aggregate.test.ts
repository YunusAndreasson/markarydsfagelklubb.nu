import { describe, expect, it } from "vitest"
import {
  aggregateYear,
  dayOfYear,
  mergeHistory,
  mergeNames,
  parseCount,
  SPARSE_REPORTS,
  safeArtportalenUrl,
  speciesIdOf,
  splitObservers,
  springArrival,
  summarise,
  toSighting,
  unnamedSpecies,
  weekIndex,
} from "./aggregate"
import type { SosRecord } from "./types"

const FETCHED = "2026-11-14T12:00:00.000Z"

function record(
  date: string,
  taxon: [number, string, string],
  extra: {
    by?: string
    count?: string
    place?: string
    category?: number
    parent?: number
    time?: string
  } = {}
): SosRecord {
  return {
    taxon: {
      id: taxon[0],
      vernacularName: taxon[1],
      scientificName: taxon[2],
      attributes:
        extra.category === undefined
          ? undefined
          : { taxonCategory: { id: extra.category }, parentDyntaxaTaxonId: extra.parent ?? null },
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
    // A hybrid row and a row from another year are left out.
    record("2026-05-01", [4, "grågås x kanadagås", "Anser anser x Branta canadensis"], {
      category: 21,
    }),
    record("2025-12-31", PRUTGAS),
  ]
  const stats = aggregateYear(2026, records, FETCHED)

  it("counts species in order of arrival", () => {
    expect(stats.speciesCount).toBe(3)
    expect(stats.species.map((one) => one.name)).toEqual(["koltrast", "trana", "prutgås"])
    expect(stats.species[0]).toMatchObject({ first: "2026-01-02", last: "2026-01-05", reports: 2 })
  })

  it("keeps a sparse year's days, and no days for a common bird", () => {
    expect(stats.species[0]?.days).toEqual(["2026-01-02", "2026-01-05"])
    const many = Array.from({ length: SPARSE_REPORTS + 1 }, (_, i) =>
      record(`2026-04-${String(i + 1).padStart(2, "0")}`, TRANA)
    )
    expect(aggregateYear(2026, many, FETCHED).species[0]?.days).toBeUndefined()
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

describe("subspecies and populations", () => {
  const KRAKA: [number, string, string] = [5, "kråka", "Corvus corone"]
  const GRAKRAKA: [number, string, string] = [50, "gråkråka", "Corvus corone cornix"]

  it("count as their species, the way Artportalen's own lists do", () => {
    const gra = record("2025-03-01", GRAKRAKA, { category: 18, parent: 5 })
    expect(speciesIdOf(gra)).toBe(5)
    expect(speciesIdOf(record("2025-03-01", KRAKA, { category: 17 }))).toBe(5)
    // A hybrid, a genus or "a or b" names no one species.
    expect(
      speciesIdOf(record("2025-03-01", [6, "gäss", "Anser/Branta"], { category: 33, parent: 1 }))
    ).toBeNull()

    const stats = aggregateYear(2025, [gra, record("2025-04-01", KRAKA, { category: 17 })], FETCHED)
    expect(stats.species.map((one) => [one.id, one.name, one.reports])).toEqual([[5, "kråka", 2]])
  })

  it("take their species' name from the map when no record in the batch has it", () => {
    const gra = record("2025-03-01", GRAKRAKA, { category: 18, parent: 5 })
    expect(unnamedSpecies([gra], null)).toEqual([5])
    expect(unnamedSpecies([gra], { "5": { name: "kråka", sci: "Corvus corone" } })).toEqual([])
    const stats = aggregateYear(2025, [gra], FETCHED, {
      "5": { name: "kråka", sci: "Corvus corone" },
    })
    expect(stats.species[0]).toMatchObject({ id: 5, name: "kråka", sci: "Corvus corone" })
  })
})

describe("springArrival", () => {
  it("skips a bird that wintered: a January report, then weeks of nothing", () => {
    // The trana on Hammarsjön, 4 and 5 January, then the others in late February.
    expect(springArrival(["2026-01-04", "2026-01-05", "2026-02-25", "2026-02-26"])).toBe(
      "2026-02-25"
    )
    expect(
      aggregateYear(2026, [record("2026-01-04", TRANA), record("2026-02-25", TRANA)], FETCHED)
        .species[0]
    ).toMatchObject({ first: "2026-01-04", arrival: "2026-02-25" })
  })

  it("keeps the first report when the reports run on from it", () => {
    expect(springArrival(["2026-02-20", "2026-02-22", "2026-03-01"])).toBe("2026-02-20")
    expect(
      aggregateYear(2026, [record("2026-02-20", TRANA)], FETCHED).species[0]?.arrival
    ).toBeUndefined()
  })

  it("never moves a spring gap: from 1 March on, a first report is an arrival", () => {
    expect(springArrival(["2026-03-10", "2026-04-20"])).toBe("2026-03-10")
  })
})

describe("toSighting", () => {
  it("marks whole-day reports as untimed and keeps a written count", () => {
    const one = toSighting({
      ...record("2026-11-12", KOLTRAST, { count: "noterad", time: "00:00" }),
      event: { startDate: "2026-11-12T00:00:00+01:00", endDate: "2026-11-12T23:59:59+01:00" },
    })
    expect(one).toMatchObject({ timed: false, count: null, countText: "noterad", name: "koltrast" })
    expect(
      toSighting(
        record("2026-11-12", [70, "tamduva", "Columba livia"], { category: 23, parent: 7 }),
        new Map([[7, { id: 7, name: "klippduva", sci: "Columba livia" }]])
      )
    ).toMatchObject({ speciesId: 7, name: "klippduva" })
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
