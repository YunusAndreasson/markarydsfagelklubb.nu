import { describe, expect, it } from "vitest"

import type { Season, SpeciesYear, TaxonIndex, YearStats } from "./artportalen/types"
import { MAX_PER_LIST, migration, thisWeek } from "./season"

const season = (
  taxa: { id: number; name: string; arrival: number | null; departure: number | null }[]
): Season => ({
  fetchedAt: "t",
  taxa: taxa.map((one) => ({ ...one, sci: `${one.name} sci`, kind: "summer" as const })),
})

const year = (species: Partial<SpeciesYear>[]): YearStats =>
  ({ year: 2026, species: species as SpeciesYear[] }) as YearStats

// 14 November 2026 is day 318.
const NOW = new Date("2026-11-14T10:00:00Z")

describe("thisWeek", () => {
  it("lists the birds that usually arrive or leave from two weeks back to two ahead", () => {
    const week = thisWeek(
      season([
        { id: 1, name: "sädgås", arrival: 320, departure: null },
        { id: 2, name: "snösparv", arrival: 314, departure: null },
        { id: 3, name: "gök", arrival: 113, departure: 211 },
        { id: 4, name: "stjärtand", arrival: 80, departure: 325 },
        { id: 5, name: "för tidig", arrival: 303, departure: null },
        { id: 6, name: "för sen", arrival: 333, departure: null },
      ]),
      NOW,
      null
    )
    expect(week.arriving.map((one) => one.name)).toEqual(["snösparv", "sädgås"])
    expect(week.leaving.map((one) => one.name)).toEqual(["stjärtand"])
  })

  it("says what this year has done: the first for an arrival, the latest for a departure", () => {
    const week = thisWeek(
      season([
        { id: 1, name: "sädgås", arrival: 320, departure: null },
        { id: 4, name: "stjärtand", arrival: 80, departure: 325 },
      ]),
      NOW,
      year([
        { id: 1, first: "2026-11-10", last: "2026-11-13" },
        { id: 4, first: "2026-03-20", last: "2026-11-02" },
      ])
    )
    expect(week.arriving[0]?.thisYear).toBe("2026-11-10")
    expect(week.leaving[0]?.thisYear).toBe("2026-11-02")
  })

  it("wraps round the new year", () => {
    const week = thisWeek(
      season([{ id: 1, name: "vintergäst", arrival: 3, departure: null }]),
      new Date("2026-12-28T10:00:00Z"),
      null
    )
    expect(week.arriving).toHaveLength(1)
  })

  it("keeps each list short, and is empty without a season", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      name: `art ${i}`,
      arrival: 320,
      departure: null,
    }))
    expect(thisWeek(season(many), NOW, null).arriving).toHaveLength(MAX_PER_LIST)
    expect(thisWeek(null, NOW, null)).toEqual({ arriving: [], leaving: [] })
  })
})

describe("migration", () => {
  // Twenty full years before 2026, and this one.
  const years = Array.from({ length: 21 }, (_, i) => 2006 + i)
  const index = (taxa: Record<number, Record<number, [number, number][]>>): TaxonIndex => ({
    fetchedAt: "t",
    years,
    taxa: Object.fromEntries(
      Object.entries(taxa).map(([id, weeks]) => [
        id,
        {
          name: `art ${id}`,
          sci: "sci",
          years: Object.fromEntries(
            Object.entries(weeks).map(([y, w]) => [y, { f: "04-01", l: "09-01", r: 1, w }])
          ),
        },
      ])
    ),
  })
  const seasonOf = (taxa: Season["taxa"]): Season => ({ fetchedAt: "t", taxa })
  const slugs = new Map([
    [1, "gok"],
    [3, "sidensvans"],
  ])
  const NOW_2026 = new Date("2026-05-20T10:00:00Z")

  it("orders summer birds by usual arrival and winter guests by their return, with this year's weeks left out", () => {
    const m = migration(
      seasonOf([
        { id: 1, name: "gök", sci: "s", arrival: 127, departure: null, kind: "summer" },
        { id: 2, name: "sånglärka", sci: "s", arrival: 60, departure: 300, kind: "summer" },
        { id: 3, name: "sidensvans", sci: "s", arrival: 298, departure: 67, kind: "winter" },
      ]),
      index({
        1: { 2010: [[18, 4]], 2025: [[18, 2]], 2026: [[18, 50]] },
        2: { 2025: [[9, 1]] },
        3: {
          2025: [
            [45, 7],
            [2, 3],
          ],
        },
      }),
      null,
      slugs,
      NOW_2026
    )
    expect(m?.summer.map((row) => row.name)).toEqual(["sånglärka", "gök"])
    expect(m?.winter.map((row) => row.name)).toEqual(["sidensvans"])
    // 2010 and 2025 are in the window; 2026 is this year, not "usually".
    expect(m?.summer[1]?.weeks[18]).toBe(6)
    expect(m?.summer[1]?.href).toBe("/arter/gok")
    expect(m?.summer[0]?.href).toBeNull()
    expect(m?.summer[1]?.arrival).toBe("7\u00a0maj")
    expect(m?.years).toBe(20)
    // 20 May is day 140, in week bin 19.
    expect(m?.today).toBe(19)
  })

  it("marks this year's arrival for a summer bird, but not a first report long after its day", () => {
    const m = migration(
      seasonOf([
        { id: 1, name: "gök", sci: "s", arrival: 127, departure: null, kind: "summer" },
        { id: 4, name: "blå kärrhök", sci: "s", arrival: 100, departure: 298, kind: "summer" },
        { id: 3, name: "sidensvans", sci: "s", arrival: 298, departure: 67, kind: "winter" },
      ]),
      index({ 1: { 2025: [[18, 2]] }, 4: { 2025: [[14, 2]] }, 3: { 2025: [[45, 7]] } }),
      year([
        { id: 1, first: "2026-05-02", last: "2026-05-19" },
        { id: 4, first: "2026-09-10", last: "2026-09-10" },
        { id: 3, first: "2026-01-04", last: "2026-03-01" },
      ]),
      slugs,
      NOW_2026
    )
    const gok = m?.summer.find((row) => row.name === "gök")
    expect(gok?.thisYear).toEqual({ week: 17, day: "2\u00a0maj" })
    expect(m?.summer.find((row) => row.name === "blå kärrhök")?.thisYear).toBeNull()
    expect(m?.winter[0]?.thisYear).toBeNull()
  })

  it("names the month most summer birds come in", () => {
    const m = migration(
      seasonOf([
        { id: 1, name: "a", sci: "s", arrival: 100, departure: null, kind: "summer" },
        { id: 2, name: "b", sci: "s", arrival: 110, departure: null, kind: "summer" },
        { id: 5, name: "c", sci: "s", arrival: 130, departure: null, kind: "summer" },
      ]),
      index({ 1: { 2025: [[14, 1]] }, 2: { 2025: [[15, 1]] }, 5: { 2025: [[18, 1]] } }),
      null,
      slugs,
      NOW_2026
    )
    expect(m?.busiest).toEqual({ month: "april", count: 2 })
  })

  it("leaves out a bird the window never saw, and needs both keys", () => {
    const m = migration(
      seasonOf([{ id: 1, name: "gök", sci: "s", arrival: 127, departure: null, kind: "summer" }]),
      index({ 1: { 2026: [[18, 3]] } }),
      null,
      slugs,
      NOW_2026
    )
    expect(m?.summer).toEqual([])
    expect(migration(null, index({}), null, slugs, NOW_2026)).toBeNull()
  })
})
