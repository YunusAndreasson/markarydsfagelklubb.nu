import { describe, expect, it } from "vitest"
import { aggregateYear, summarise } from "@/lib/artportalen/aggregate"
import type { History, SosRecord, YearSummary } from "@/lib/artportalen/types"
import { barsSvg, linesSvg } from "@/lib/charts/svg"
import {
  accumulation,
  bestSince,
  byArrivalMonth,
  continuousYears,
  decades,
  jubilee,
  monthName,
  monthShares,
  ordinal,
  paceAgainstAverage,
  parseYearParam,
  recordYear,
  shortDay,
  speciesCurves,
  yearHeadline,
} from "./obsar-stats"

const at = (date: string, id: number): SosRecord => ({
  taxon: { id, vernacularName: `art ${id}`, scientificName: "" },
  event: { startDate: `${date}T08:00:00+01:00` },
})

const line = (year: number, reports: number, species = 10, observers = 2): YearSummary => ({
  year,
  reports,
  species,
  observers,
  individuals: 0,
  months: [reports, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  weeks: new Array(53).fill(species),
})

const history: History = {
  fetchedAt: "",
  years: [
    line(1984, 50, 40),
    line(1986, 200, 90),
    line(1987, 100, 80),
    line(2014, 4420, 165, 60),
    line(2026, 3120, 153, 110),
  ],
}

describe("speciesCurves", () => {
  const now = summarise(aggregateYear(2026, [at("2026-01-01", 1), at("2026-03-01", 2)], ""))
  const last = summarise(
    aggregateYear(2025, [at("2025-01-01", 1), at("2025-01-02", 2), at("2025-06-01", 3)], "")
  )
  const curves = speciesCurves({ fetchedAt: "", years: [last, now] }, 2026, "2026-03-10")

  it("stops this year's line at this week", () => {
    expect(curves?.current[0]).toBe(1)
    expect(curves?.current[9]).toBe(2)
    expect(curves?.current[10]).toBeNull()
    expect(curves?.current).toHaveLength(53)
  })

  it("compares with last year and the average", () => {
    expect(curves?.previous?.[0]).toBe(2)
    expect(curves?.averageYears).toBe(1)
    expect(curves && paceAgainstAverage(curves)).toBe(0)
  })

  it("spans the earlier years' fewest and most, week by week", () => {
    const before = summarise(aggregateYear(2024, [at("2024-01-01", 1)], ""))
    const three = speciesCurves({ fetchedAt: "", years: [before, last, now] }, 2026, "2026-03-10")
    expect(three?.averageYears).toBe(2)
    expect(three?.low?.[0]).toBe(1)
    expect(three?.high?.[0]).toBe(2)
    expect(three?.low).toHaveLength(53)
    expect(three?.average?.[0]).toBe(1.5)
  })

  it("needs the year's weekly curve", () => {
    expect(speciesCurves({ fetchedAt: "", years: [] }, 2026, "2026-03-10")).toBeNull()
  })
})

describe("records", () => {
  it("finds the record years", () => {
    expect(recordYear(history.years, "reports")).toEqual({ year: 2014, value: 4420 })
    expect(recordYear(history.years, "observers")).toEqual({ year: 2026, value: 110 })
  })

  it("says since when a year is the best", () => {
    expect(bestSince(history.years, 2026, "reports")).toBe(2014)
    expect(bestSince(history.years, 2014, "reports")).toBeNull()
  })
})

describe("jubilee, decades and accumulation", () => {
  const allTime = {
    fetchedAt: "",
    taxa: [
      { id: 1, first: "1974-05-19", last: "2026-10-31", reports: 9 },
      { id: 2, first: "1986-04-01", last: "1990-01-01", reports: 2 },
      { id: 3, first: "2026-10-28", last: "2026-10-28", reports: 1 },
      { id: 4, first: "1960-01-01", last: "1961-01-01", reports: 1 },
    ],
  }

  it("counts what the club's years hold", () => {
    expect(jubilee(history, allTime)).toEqual({
      reportsSinceFounding: 7840,
      reportsAll: 7890,
      speciesAll: 4,
      speciesSinceFounding: 3,
      firstYear: 1984,
      yearsWithReports: 5,
    })
  })

  it("groups decades", () => {
    expect(decades(history).map((one) => [one.decade, one.reports, one.years])).toEqual([
      [1980, 350, 3],
      [2010, 4420, 1],
      [2020, 3120, 1],
    ])
  })

  it("fills the gaps between years", () => {
    expect(continuousYears(history, 1984, 1987).map((one) => [one.year, one.reports])).toEqual([
      [1984, 50],
      [1985, 0],
      [1986, 200],
      [1987, 100],
    ])
  })

  it("grows the kommun list year by year", () => {
    const grown = accumulation(allTime, 1974, 2026)
    expect(grown[0]).toEqual({ year: 1974, total: 2, added: 1 })
    expect(grown.find((one) => one.year === 1986)?.total).toBe(3)
    expect(grown.at(-1)).toEqual({ year: 2026, total: 4, added: 1 })
  })

  it("shares a year's reports by month", () => {
    expect(monthShares([line(2000, 4)])[0][0]).toBe(100)
  })
})

describe("svg fallbacks", () => {
  it("draws marked bars in their own colour and skips empty years", () => {
    const svg = barsSvg({
      bars: [{ value: 1 }, { value: 0 }, { value: 2, mark: true }],
      width: 30,
      height: 10,
      color: "#fff",
      markColor: "#f00",
    })
    expect(svg).toContain('fill="#fff"')
    expect(svg).toContain('fill="#f00"')
    expect(svg.match(/Z/g)).toHaveLength(2)
    expect(svg).toContain('aria-hidden="true"')
  })

  it("breaks a line at null", () => {
    const svg = linesSvg({
      lines: [{ values: [1, 2, null, 3], color: "#000" }],
      width: 30,
      height: 10,
    })
    expect(svg.match(/M/g)).toHaveLength(2)
  })
})

describe("parseYearParam and byArrivalMonth", () => {
  it("accepts this year and years with data", () => {
    expect(parseYearParam(undefined, [1993], 2026)).toBe(2026)
    expect(parseYearParam("1993", [1993], 2026)).toBe(1993)
    expect(parseYearParam("1994", [1993], 2026)).toBeNull()
    expect(parseYearParam("19x3", [1993], 2026)).toBeNull()
  })

  it("groups arrivals by month", () => {
    const groups = byArrivalMonth([
      { first: "2026-01-02" },
      { first: "2026-01-09" },
      { first: "2026-03-01" },
    ])
    expect(groups.map((one) => [one.month, one.species.length])).toEqual([
      [0, 2],
      [2, 1],
    ])
  })
})

describe("ordinal", () => {
  it("writes Swedish ordinals", () => {
    expect([1, 2, 3, 11, 12, 21, 22, 101, 112, 153].map(ordinal)).toEqual([
      "1:a",
      "2:a",
      "3:e",
      "11:e",
      "12:e",
      "21:a",
      "22:a",
      "101:a",
      "112:e",
      "153:e",
    ])
  })
})

describe("monthName and shortDay", () => {
  it("names months in Swedish", () => {
    expect(monthName(0)).toBe("januari")
    expect(monthName(8, true)).toBe("September")
  })

  it("shortens a date without the trailing period", () => {
    expect(shortDay("2026-01-02")).toBe("2 jan")
    expect(shortDay("2026-11-11")).toBe("11 nov")
  })
})

describe("yearHeadline", () => {
  it("names the count and the newest species", () => {
    expect(
      yearHeadline({ speciesCount: 153, species: [{ name: "prutgås", first: "2026-11-11" }] })
    ).toBe("I år har 153 arter rapporterats i kommunen, den senaste prutgås den 11 november.")
    expect(yearHeadline({ speciesCount: 0, species: [] })).toBe(
      "I år har inga arter rapporterats i kommunen."
    )
  })
})
