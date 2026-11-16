import { describe, expect, it } from "vitest"
import type { PastDay, PastMonth } from "@/lib/artportalen/types"
import { daysApart, pickPast, windowMonths, worthShowing } from "./past-sightings"

const names = {
  1: { name: "eremitibis", sci: "Geronticus eremita" },
  2: { name: "brunand", sci: "Aythya ferina" },
  3: { name: "kungsfågel", sci: "Regulus regulus" },
  4: { name: "koltrast", sci: "Turdus merula" },
  5: { name: "brudand", sci: "Aix sponsa" },
}
const club = [
  { name: "Eremitibis", sci: "Geronticus eremita", rarity: 1 },
  { name: "Brunand", sci: "Aythya ferina", rarity: 3 },
  { name: "Kungsfågel", sci: "Regulus regulus", rarity: 4 },
  { name: "Koltrast", sci: "Turdus merula", rarity: 5 },
]
const month = (m: number, days: PastDay[]): PastMonth => ({ fetchedAt: "t", month: m, days, names })

describe("worthShowing", () => {
  it("keeps the rare prefixes, 0–2, and nothing commoner", () => {
    expect(worthShowing(0)).toBe(true)
    expect(worthShowing(2)).toBe(true)
    expect(worthShowing(3)).toBe(false)
    expect(worthShowing(4)).toBe(false)
    expect(worthShowing(5)).toBe(false)
  })
})

describe("the window", () => {
  it("reads two months at a month's edge, round New Year too", () => {
    expect(windowMonths("2026-11-15")).toEqual([11])
    expect(windowMonths("2026-12-30").sort()).toEqual([1, 12])
    expect(windowMonths("2026-03-02").sort()).toEqual([2, 3])
  })

  it("counts days round the year, with 29 February in its place", () => {
    expect(daysApart("12-30", "01-02")).toBe(3)
    expect(daysApart("02-28", "03-01")).toBe(2)
    expect(daysApart("02-29", "03-01")).toBe(1)
  })
})

describe("pickPast", () => {
  it("joins the club's prefix and keeps only what is worth showing", () => {
    const picked = pickPast(
      [
        month(11, [
          [1, 2023, "11-14", 1],
          [2, 1994, "11-16", 3],
          [2, 1977, "11-15", 12],
          [3, 2001, "11-15", 1],
          [3, 2002, "11-15", 2],
          [4, 1990, "11-15", 1],
          [5, 2020, "11-15", 1],
        ]),
      ],
      club,
      "2026-11-15"
    )
    // Brunand (3) and Kungsfågel (4) are commoner birds, Koltrast (5) too.
    expect(picked).toEqual([
      {
        taxonId: 1,
        name: "Eremitibis",
        rarity: 1,
        sightings: [{ year: 2023, date: "2023-11-14" }],
      },
    ])
  })

  it("leaves out this year and days outside the window", () => {
    const picked = pickPast(
      [
        month(11, [
          [1, 2026, "11-15", 1],
          [1, 2020, "11-23", 1],
          [1, 2019, "11-22", 1],
        ]),
      ],
      club,
      "2026-11-15"
    )
    expect(picked[0]?.sightings).toEqual([{ year: 2019, date: "2019-11-22" }])
  })

  it("finds December's birds from early January", () => {
    const picked = pickPast(
      [month(12, [[1, 2010, "12-31", 1]]), month(1, [[1, 2011, "01-01", 1]])],
      club,
      "2027-01-02"
    )
    expect(picked[0]?.sightings.map((one) => one.year)).toEqual([2011, 2010])
  })

  it("gives a year one line, on the day nearest today", () => {
    const picked = pickPast(
      [
        month(11, [
          [1, 2020, "11-12", 1],
          [1, 2020, "11-16", 1],
        ]),
      ],
      club,
      "2026-11-15"
    )
    expect(picked[0]?.sightings).toEqual([{ year: 2020, date: "2020-11-16" }])
  })

  it("keeps only the rare prefixes, rarest first", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      name: `Art ${i}`,
      sci: `Sci ${i}`,
      rarity: i % 5,
    }))
    const more: PastMonth = {
      fetchedAt: "t",
      month: 5,
      days: many.map((_, i) => [100 + i, 2000, "05-10", 1] as PastDay),
      names: Object.fromEntries(many.map((one, i) => [100 + i, { name: one.name, sci: one.sci }])),
    }
    const picked = pickPast([more], many, "2026-05-10")
    expect(picked.map((one) => one.rarity)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2])
  })
})
