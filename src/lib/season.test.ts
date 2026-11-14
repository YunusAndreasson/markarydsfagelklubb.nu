import { describe, expect, it } from "vitest"

import type { Season, SpeciesYear, YearStats } from "./artportalen/types"
import { MAX_PER_LIST, thisWeek } from "./season"

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
