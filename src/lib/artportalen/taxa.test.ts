import { describe, expect, it } from "vitest"

import {
  arrivals,
  buildSeason,
  mergeTaxa,
  needsRebuild,
  rebuildTaxa,
  SEASON_MIN_YEARS,
  seasonWindow,
  sparseWeeks,
  summerGap,
  typicalDays,
  weeksTotal,
} from "./taxa"
import type { SpeciesYear, TaxonEntry, YearStats } from "./types"

const weeks = (bins: Record<number, number>) =>
  Array.from({ length: 53 }, (_, week) => bins[week] ?? 0)

const species = (
  id: number,
  name: string,
  first: string,
  last: string,
  bins: Record<number, number> = { 16: 2 }
): SpeciesYear => ({ id, name, sci: `${name} sci`, first, last, reports: 2, weeks: weeks(bins) })

const year = (y: number, list: SpeciesYear[]): YearStats => ({
  year: y,
  fetchedAt: "t",
  reports: list.length ? 10 : 0,
  individuals: 0,
  speciesCount: list.length,
  observerCount: 1,
  species: list,
  months: { reports: [], species: [] },
  curve: [],
  localities: [],
  league: [],
})

describe("mergeTaxa", () => {
  it("files each species under its year, with month-day dates and sparse weeks", () => {
    const index = mergeTaxa(null, year(2024, [species(1, "Gök", "2024-04-23", "2024-07-30")]), "t")
    expect(index.years).toEqual([2024])
    expect(index.taxa[1]?.years["2024"]).toEqual({ f: "04-23", l: "07-30", r: 2, w: [[16, 2]] })
  })

  it("replaces a year on a second merge instead of adding to it", () => {
    let index = mergeTaxa(null, year(2024, [species(1, "Gök", "2024-04-23", "2024-07-30")]), "t")
    index = mergeTaxa(index, year(2024, [species(1, "Gök", "2024-04-20", "2024-08-01")]), "t")
    expect(Object.keys(index.taxa[1]?.years ?? {})).toEqual(["2024"])
    expect(index.taxa[1]?.years["2024"]?.f).toBe("04-20")
  })

  it("drops a taxon from a year it turns out not to have been seen, and entirely when no year is left", () => {
    let index = mergeTaxa(
      null,
      year(2024, [species(9, "Felbestämd", "2024-05-01", "2024-05-01")]),
      "t"
    )
    index = mergeTaxa(index, year(2024, [species(1, "Gök", "2024-04-23", "2024-07-30")]), "t")
    expect(index.taxa[9]).toBeUndefined()
  })

  it("names a taxon after its newest year, whatever order the years arrive in", () => {
    let index = mergeTaxa(null, year(2025, [species(1, "Gök", "2025-04-23", "2025-07-30")]), "t")
    index = mergeTaxa(
      index,
      year(1990, [species(1, "Gök (gammalt)", "1990-04-23", "1990-07-30")]),
      "t"
    )
    expect(index.taxa[1]?.name).toBe("Gök")
  })
})

describe("rebuildTaxa and needsRebuild", () => {
  it("builds the same index as merging year by year", () => {
    const years = [
      year(2023, [species(1, "Gök", "2023-04-25", "2023-07-30")]),
      year(2024, [species(1, "Gök", "2024-04-23", "2024-07-30")]),
    ]
    const rebuilt = rebuildTaxa(years, "t")
    expect(rebuilt).toEqual(
      mergeTaxa(mergeTaxa(null, years[0] as YearStats, "t"), years[1] as YearStats, "t")
    )
    expect(needsRebuild(rebuilt, [2023, 2024])).toBe(false)
    expect(needsRebuild(rebuilt, [2022, 2023, 2024])).toBe(true)
    expect(needsRebuild(null, [2024])).toBe(true)
    expect(needsRebuild(null, [])).toBe(false)
  })
})

/** A taxon seen in each of `years`, arriving and leaving on the given month-days. */
/** Reported all year round, as a resident is. */
const ALL_YEAR: [number, number][] = [
  [2, 3],
  [14, 3],
  [26, 3],
  [38, 3],
  [50, 3],
]

const entry = (
  years: number[],
  f: (y: number) => string,
  l: (y: number) => string,
  w: [number, number][] = [[16, 3]]
): TaxonEntry => ({
  name: "Gök",
  sci: "Cuculus canorus",
  years: Object.fromEntries(years.map((y) => [y, { f: f(y), l: l(y), r: 3, w }])),
})

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

describe("typicalDays", () => {
  const window = seasonWindow(range(2000, 2026), 2026)

  it("looks back over the last twenty past years, never the current one", () => {
    expect(window).toEqual(range(2006, 2025))
  })

  it("takes the median first and last day, so one freak early bird doesn't move it", () => {
    const gok = entry(
      range(2006, 2025),
      (y) => (y === 2010 ? "03-01" : "04-23"),
      () => "07-30"
    )
    const typical = typicalDays(gok, window)
    // 23 April is day 113 in a common year and 114 in a leap year.
    expect(typical.arrival).toBeGreaterThanOrEqual(113)
    expect(typical.arrival).toBeLessThanOrEqual(114)
    expect(typical.departure).toBeGreaterThanOrEqual(211)
  })

  it("has no arrival for a resident, already seen in early January", () => {
    const koltrast = entry(
      range(2006, 2025),
      () => "01-02",
      () => "12-30",
      ALL_YEAR
    )
    expect(typicalDays(koltrast, window)).toMatchObject({ arrival: null, departure: null })
  })

  it("doesn't take a resident few report before March for a spring arrival", () => {
    const tjader = entry(
      range(2006, 2025),
      () => "03-10",
      () => "10-20",
      ALL_YEAR
    )
    expect(typicalDays(tjader, window)).toMatchObject({ arrival: null, kind: null })
  })

  it("doesn't let a resident 'leave' when its reports thin out in winter", () => {
    // Seen from early January, last reported mid-November most years.
    const pilfink = entry(
      range(2006, 2025),
      () => "01-05",
      () => "11-15",
      ALL_YEAR
    )
    expect(typicalDays(pilfink, window)).toMatchObject({ arrival: null, departure: null })
  })

  it("reads a winter guest off its summer gap: back in the autumn, gone in the spring", () => {
    // Weeks 0–13 and 41–52 every year, nothing over the summer.
    const sadgas: TaxonEntry = {
      name: "sädgås",
      sci: "Anser fabalis",
      years: Object.fromEntries(
        range(2006, 2025).map((y) => [
          y,
          {
            f: "01-03",
            l: "12-28",
            r: 9,
            w: [
              [0, 2],
              [13, 3],
              [41, 4],
              [52, 1],
            ] as [number, number][],
          },
        ])
      ),
    }
    expect(typicalDays(sadgas, window)).toEqual({
      arrival: 41 * 7 + 4,
      departure: 13 * 7 + 4,
      kind: "winter",
      years: 20,
    })
  })

  it("has no season for a visitor seen in too few years", () => {
    const rare = entry(
      range(2006, 2006 + SEASON_MIN_YEARS - 2),
      () => "05-10",
      () => "05-12"
    )
    expect(typicalDays(rare, window)).toMatchObject({ arrival: null, departure: null })
  })
})

describe("buildSeason", () => {
  it("keeps only taxa with a season, alphabetically", () => {
    const index = rebuildTaxa(
      range(2006, 2025).map((y) =>
        year(y, [
          species(1, "Gök", `${y}-04-23`, `${y}-07-30`),
          species(2, "Koltrast", `${y}-01-02`, `${y}-12-30`, { 2: 1, 14: 1, 26: 1, 38: 1, 50: 1 }),
          species(3, "Ärtsångare", `${y}-05-05`, `${y}-08-20`),
        ])
      ),
      "t"
    )
    const season = buildSeason(index, 2026, "t")
    expect(season.taxa.map((one) => one.name)).toEqual(["Gök", "Ärtsångare"])
  })
})

describe("summerGap", () => {
  it("finds a long gap in summer, and ignores a short or a winter one", () => {
    expect(
      summerGap([
        [0, 1],
        [12, 1],
        [42, 1],
      ])
    ).toEqual({ left: 12, back: 42 })
    expect(
      summerGap([
        [20, 1],
        [24, 1],
      ])
    ).toBeNull()
    expect(
      summerGap([
        [40, 1],
        [52, 1],
      ])
    ).toBeNull()
  })
})

describe("weeksTotal and arrivals", () => {
  it("sums the week bins over the years, and lists first days oldest first", () => {
    const gok = entry(
      [2025, 2024],
      (y) => (y === 2024 ? "04-20" : "04-25"),
      () => "07-30"
    )
    expect(weeksTotal(gok)[16]).toBe(6)
    expect(arrivals(gok).map((one) => one.year)).toEqual([2024, 2025])
    expect(sparseWeeks([0, 2, 0, 1])).toEqual([
      [1, 2],
      [3, 1],
    ])
  })
})
