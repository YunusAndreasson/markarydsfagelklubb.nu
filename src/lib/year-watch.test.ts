import { describe, expect, it } from "vitest"

import type { TaxonEntry, TaxonIndex, TaxonYear } from "./artportalen/types"
import {
  missingBirds,
  missingNote,
  ratioPhrase,
  unusualBirds,
  weeksBefore,
  yearTotals,
} from "./year-watch"

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)
const WINDOW = range(2006, 2025)

/** A year with `perWeek` reports in each of weeks 0–45, first seen on `first`. */
const year = (perWeek: number, first = "01-03"): TaxonYear => ({
  f: first,
  l: "11-10",
  r: perWeek * 46,
  w: range(0, 45).map((week) => [week, perWeek] as [number, number]),
})

const taxon = (name: string, years: Record<number, TaxonYear>): TaxonEntry => ({
  name,
  sci: name,
  years,
})

const every = (years: number[], make: (y: number) => TaxonYear) =>
  Object.fromEntries(years.map((y) => [y, make(y)]))

describe("missingNote", () => {
  const vinterhampling = taxon(
    "vinterhämpling",
    every(WINDOW, () => year(1, "10-26"))
  )

  it("flags a bird seen by now nearly every year and not this year", () => {
    expect(missingNote(vinterhampling, WINDOW, 2026, 319)).toEqual({
      byNow: 20,
      of: 20,
      usual: 299,
    })
  })

  it("says nothing before its usual date, or once it is seen", () => {
    expect(missingNote(vinterhampling, WINDOW, 2026, 290)).toBeNull()
    const seen = taxon("vinterhämpling", { ...vinterhampling.years, 2026: year(1, "11-01") })
    expect(missingNote(seen, WINDOW, 2026, 319)).toBeNull()
  })

  it("never calls a renamed taxon missing: it must have been seen last year", () => {
    const renamed = taxon(
      "gammalt namn",
      every(range(2006, 2023), () => year(1, "04-01"))
    )
    expect(missingNote(renamed, WINDOW, 2026, 319)).toBeNull()
  })

  it("needs a long enough window", () => {
    expect(missingNote(vinterhampling, range(2015, 2025), 2026, 319)).toBeNull()
  })
})

describe("unusualBirds", () => {
  // Steady background birds, so the totals are not just the birds under test.
  const background = taxon(
    "bofink",
    every([...WINDOW, 2026], () => year(20))
  )
  const index = (entries: Record<string, TaxonEntry>): TaxonIndex => ({
    fetchedAt: "",
    years: [...WINDOW, 2026],
    taxa: { 1: background, ...entries },
  })

  it("finds a bird with several times its usual share, and one with a fraction", () => {
    const result = unusualBirds(
      index({
        2: taxon(
          "tjäder",
          every([...WINDOW, 2026], (y) => year(y === 2026 ? 6 : 1))
        ),
        3: taxon(
          "knölsvan",
          every([...WINDOW, 2026], (y) => year(y === 2026 ? 1 : 5))
        ),
      }),
      WINDOW,
      2026,
      319
    )
    expect(result.more.map((one) => one.name)).toEqual(["tjäder"])
    expect(result.less.map((one) => one.name)).toEqual(["knölsvan"])
    expect(result.more[0]?.ratio).toBeGreaterThan(5)
  })

  it("doesn't call a bird common in a busier year unusual: shares, not counts", () => {
    // Everything doubles this year: more reporters, not more birds.
    const busy = index({
      1: taxon(
        "bofink",
        every([...WINDOW, 2026], (y) => year(y === 2026 ? 40 : 20))
      ),
      2: taxon(
        "talltita",
        every([...WINDOW, 2026], (y) => year(y === 2026 ? 4 : 2))
      ),
    })
    expect(unusualBirds(busy, WINDOW, 2026, 319)).toEqual({ more: [], less: [] })
  })

  it("leaves out a bird too thin to judge", () => {
    const rare = taxon(
      "rar",
      every([...WINDOW, 2026], (y) => year(y === 2026 ? 0.1 : 0.01))
    )
    expect(unusualBirds(index({ 2: rare }), WINDOW, 2026, 319).more).toEqual([])
  })
})

describe("yearTotals and weeksBefore", () => {
  it("counts only whole weeks before today's", () => {
    expect(weeksBefore(1)).toBe(0)
    expect(weeksBefore(15)).toBe(2)
    const one = taxon("x", { 2026: year(1) })
    const idx: TaxonIndex = { fetchedAt: "", years: [2026], taxa: { 1: one } }
    expect(yearTotals(idx, [2026], 2).get(2026)).toBe(2)
  })
})

describe("missingBirds", () => {
  it("puts the surest first", () => {
    const sure = taxon(
      "säker",
      every(WINDOW, () => year(1, "04-01"))
    )
    const likely = taxon(
      "trolig",
      every(range(2009, 2025), () => year(1, "04-01"))
    )
    const idx: TaxonIndex = { fetchedAt: "", years: WINDOW, taxa: { 1: likely, 2: sure } }
    expect(missingBirds(idx, WINDOW, 2026, 200).map((one) => one.name)).toEqual(["säker", "trolig"])
  })
})

describe("ratioPhrase", () => {
  it("rounds down, so it never says more than the numbers", () => {
    expect(ratioPhrase(2.9)).toBe("dubbelt så många rapporter som vanligt")
    expect(ratioPhrase(5.6)).toBe("fem gånger så många rapporter som vanligt")
    expect(ratioPhrase(14)).toBe("mer än tio gånger så många rapporter som vanligt")
    expect(ratioPhrase(0.45)).toBe("hälften så många rapporter som vanligt")
    expect(ratioPhrase(0.3)).toBe("en tredjedel så många rapporter som vanligt")
    expect(ratioPhrase(0.12)).toBe("en åttondel så många rapporter som vanligt")
    expect(ratioPhrase(0.05)).toBe("mindre än en tiondel så många rapporter som vanligt")
  })
})
