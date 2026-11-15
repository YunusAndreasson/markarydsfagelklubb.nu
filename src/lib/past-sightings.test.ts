import { describe, expect, it } from "vitest"
import type { PastDay, PastMonth } from "@/lib/artportalen/types"
import {
  daysApart,
  PER_GROUP,
  pickPast,
  splitPast,
  windowMonths,
  worthShowing,
} from "./past-sightings"

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
  it("keeps 0–2 always, 3 and 4 only in a scarce year, never 5", () => {
    expect(worthShowing(2, 10)).toBe(true)
    expect(worthShowing(3, 3)).toBe(true)
    expect(worthShowing(3, 4)).toBe(false)
    expect(worthShowing(4, 1)).toBe(true)
    expect(worthShowing(4, 2)).toBe(false)
    expect(worthShowing(5, 1)).toBe(false)
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
    expect(picked).toEqual([
      {
        taxonId: 1,
        name: "Eremitibis",
        rarity: 1,
        sightings: [{ year: 2023, date: "2023-11-14" }],
      },
      { taxonId: 2, name: "Brunand", rarity: 3, sightings: [{ year: 1994, date: "1994-11-16" }] },
      {
        taxonId: 3,
        name: "Kungsfågel",
        rarity: 4,
        sightings: [{ year: 2001, date: "2001-11-15" }],
      },
    ])
  })

  it("leaves out this year and days outside the window", () => {
    const picked = pickPast(
      [
        month(11, [
          [1, 2026, "11-15", 1],
          [1, 2020, "11-19", 1],
          [1, 2019, "11-18", 1],
        ]),
      ],
      club,
      "2026-11-15"
    )
    expect(picked[0]?.sightings).toEqual([{ year: 2019, date: "2019-11-18" }])
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

  it("puts the rarest first, and splits rare from scarce, four of each", () => {
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
    expect(picked.map((one) => one.rarity)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4])
    const { rare, scarce } = splitPast(picked)
    expect(rare).toHaveLength(PER_GROUP)
    expect(rare.map((one) => one.rarity)).toEqual([0, 0, 0, 1])
    expect(scarce.map((one) => one.rarity)).toEqual([3, 3, 3, 4])
  })
})
