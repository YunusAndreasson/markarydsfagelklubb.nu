import { describe, expect, it } from "vitest"

import type { TaxonEntry } from "./artportalen/types"
import {
  arrivalFigure,
  arrivalSentence,
  dayMonth,
  leadSentence,
  seasonsPhrase,
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

  it("doesn't call a first report in September a late arrival", () => {
    // Blå kärrhök 2026: not seen in spring, only on its way back.
    const harrier = entry(range(2006, 2026), (y) => (y === 2026 ? "09-26" : "04-10"))
    expect(arrivalSentence(harrier, 100, 2026)).toBe(
      "I år sågs den inte när den brukar komma, utan först 26 sep. Tidigast: 10 apr 2006."
    )
    expect(arrivalFigure(harrier, 2026, 100)?.dots.some((dot) => dot.year === 2026)).toBe(false)
  })

  it("says so when none has come yet this year", () => {
    const gok = entry(range(2006, 2025), () => "04-23")
    expect(arrivalSentence(gok, 113, 2026)).toContain("I år har ingen rapporterats än.")
  })
})

describe("leadSentence", () => {
  it("names a summer bird's coming, not its last report", () => {
    expect(
      leadSentence({ arrival: 127, departure: 185, kind: "summer", years: 20 }, 20, null, 2026, [])
    ).toBe("En flyttfågel som brukar komma till kommunen kring 7 maj.")
  })

  it("tells a winter guest by its autumn return", () => {
    expect(
      leadSentence({ arrival: 291, departure: 95, kind: "winter", years: 20 }, 20, null, 2026, [])
    ).toBe(
      "En vintergäst som brukar komma till kommunen kring 18 okt och stanna kvar till omkring 5 apr."
    )
  })

  it("has a plain line for a resident, a rare guest and a bird long gone", () => {
    const none = { arrival: null, departure: null, kind: null }
    const allYear = Array.from({ length: 53 }, () => 2)
    expect(leadSentence({ ...none, years: 20 }, 20, null, 2026, allYear)).toContain("året runt")
    expect(leadSentence({ ...none, years: 3 }, 20, null, 2026, [])).toBe(
      "Sedd i kommunen tre av de senaste tjugo åren, en ovanlig gäst."
    )
    expect(leadSentence({ ...none, years: 0 }, 20, { first: 1970, last: 1996 }, 2026, [])).toBe(
      "Inte rapporterad i kommunen de senaste tjugo åren. Senast sedd 1996."
    )
  })

  it("says nothing about the twenty years until the index holds them", () => {
    // Production before its first nights: only this year is in the index, so
    // an ärtsångare seen every year has no past year in the window.
    const none = { arrival: null, departure: null, kind: null, years: 0 }
    expect(leadSentence(none, 0, { first: 1966, last: 2026 }, 2026, [])).toBeNull()
    expect(
      leadSentence({ ...none, years: 8 }, 16, { first: 1966, last: 2026 }, 2026, [])
    ).toBeNull()
  })

  it("tells a bird back this year after twenty years from one new to the kommun", () => {
    const none = { arrival: null, departure: null, kind: null, years: 0 }
    expect(leadSentence(none, 20, { first: 1980, last: 2026 }, 2026, [])).toBe(
      "Sedd i kommunen i år, för första gången på över tjugo år."
    )
    expect(leadSentence(none, 20, { first: 2026, last: 2026 }, 2026, [])).toBe(
      "Ny för kommunen i år."
    )
  })

  it("says 'varje år' only for all twenty, and names no season from a handful of reports", () => {
    const none = { arrival: null, departure: null, kind: null }
    const spring = Array.from({ length: 53 }, (_, week) => (week === 15 ? 30 : 0))
    expect(leadSentence({ ...none, years: 19 }, 20, null, 2026, spring)).toBe(
      "Ses i kommunen nästan varje år, mest på våren."
    )
    // One berguv in twenty years isn't "mest på våren".
    const one = Array.from({ length: 53 }, (_, week) => (week === 15 ? 1 : 0))
    expect(leadSentence({ ...none, years: 1 }, 20, null, 2026, one)).toBe(
      "Sedd i kommunen en av de senaste tjugo åren, en ovanlig gäst."
    )
  })

  it("never says 'året runt' about a bird that only passes in the autumn", () => {
    const october = Array.from({ length: 53 }, (_, week) => (week >= 40 && week <= 46 ? 5 : 0))
    expect(
      leadSentence(
        { arrival: null, departure: null, kind: null, years: 20 },
        20,
        null,
        2026,
        october
      )
    ).toBe("Ses i kommunen varje år, mest på hösten.")
  })
})

describe("seasonsPhrase", () => {
  const weeks = (...ranges: [number, number][]) =>
    Array.from({ length: 53 }, (_, week) =>
      ranges.some(([from, to]) => week >= from && week <= to) ? 5 : 0
    )

  it("names one season, or two in the order they run", () => {
    expect(seasonsPhrase(weeks([40, 46]))).toBe("mest på hösten")
    expect(seasonsPhrase(weeks([12, 18], [36, 42]))).toBe("mest under våren och hösten")
    expect(seasonsPhrase(weeks([0, 6], [44, 46]))).toBe("mest under hösten och vintern")
  })

  it("is null for a bird seen the year round", () => {
    expect(seasonsPhrase(Array.from({ length: 53 }, () => 1))).toBeNull()
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
