import { describe, expect, it } from "vitest"

import type { TaxonEntry } from "./artportalen/types"
import {
  arrivalFigure,
  arrivalSentence,
  dayMonth,
  leadSentence,
  yearSentence,
} from "./species-page"

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

const entry = (years: number[], first: (y: number) => string): TaxonEntry => ({
  name: "gök",
  sci: "Cuculus canorus",
  years: Object.fromEntries(years.map((y) => [y, { f: first(y), l: "07-30", r: 2, w: [[16, 2]] }])),
})

describe("dayMonth", () => {
  it("writes a day of the year the site's way, with no full stop", () => {
    expect(dayMonth(1)).toBe("1 jan")
    expect(dayMonth(113)).toBe("23 apr")
  })
})

describe("arrivalSentence", () => {
  it("says how this year compares, and the earliest", () => {
    const gok = entry(range(2006, 2026), (y) =>
      y === 2014 ? "04-09" : y === 2026 ? "04-18" : "04-23"
    )
    expect(arrivalSentence(gok, 113, 2026)).toBe(
      "I år kom den första 18 apr, fem dagar tidigare än vanligt. Tidigast: 9 apr 2014."
    )
  })

  it("says so when none has come yet this year", () => {
    const gok = entry(range(2006, 2025), () => "04-23")
    expect(arrivalSentence(gok, 113, 2026)).toContain("I år har ingen rapporterats än.")
  })
})

describe("leadSentence", () => {
  it("names a summer bird's coming, not its last report", () => {
    expect(leadSentence({ arrival: 127, departure: 185, kind: "summer", years: 20 }, 2026)).toBe(
      "En flyttfågel som brukar komma till kommunen kring 7 maj."
    )
  })

  it("tells a winter guest by its autumn return", () => {
    expect(leadSentence({ arrival: 291, departure: 95, kind: "winter", years: 20 }, 2026)).toBe(
      "En vintergäst som brukar komma till kommunen kring 18 okt och stanna till kring 5 apr."
    )
  })

  it("has a plain line for a resident, a rare guest and a bird long gone", () => {
    const none = { arrival: null, departure: null, kind: null }
    expect(leadSentence({ ...none, years: 20 }, 2026)).toContain("året runt")
    expect(leadSentence({ ...none, years: 3 }, 2026)).toBe(
      "Sedd i kommunen tre av de senaste tjugo åren, en ovanlig gäst."
    )
    expect(leadSentence({ ...none, years: 0 }, 1996)).toBe(
      "Inte rapporterad i kommunen de senaste tjugo åren. Senast sedd 1996."
    )
  })
})

describe("arrivalFigure", () => {
  it("puts this year's dot apart, later lower, with month labels in range", () => {
    const figure = arrivalFigure(
      entry(range(2020, 2026), (y) => `04-${10 + (y - 2020)}`),
      2026,
      113
    )
    expect(figure?.dots.at(-1)?.current).toBe(true)
    const [early, late] = [figure?.dots[0], figure?.dots.at(-1)]
    expect((late?.y ?? 0) > (early?.y ?? 0)).toBe(true)
    expect(figure?.months.map((one) => one.label)).toContain("1 apr")
  })

  it("draws nothing from fewer than three years", () => {
    expect(
      arrivalFigure(
        entry([2025, 2026], () => "04-20"),
        2026,
        null
      )
    ).toBeNull()
  })
})

describe("yearSentence", () => {
  it("names the busiest month, or two when they're close", () => {
    const weeks = Array.from({ length: 53 }, () => 0)
    weeks[15] = 10 // mid-April
    expect(yearSentence(weeks)).toBe("Flest rapporter kommer i april.")
    weeks[19] = 8 // mid-May
    expect(yearSentence(weeks)).toBe("Flest rapporter kommer i april och maj.")
    expect(yearSentence(Array.from({ length: 53 }, () => 0))).toBeNull()
  })
})
