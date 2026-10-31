import { describe, expect, it } from "vitest"

import { digestDay, pageOfDays, speciesCount } from "./larm-digest"

const larm = (id: string, over: Partial<Parameters<typeof digestDay>[0][number]> = {}) => ({
  id,
  observedAt: "2026-10-31T12:00:00Z",
  species: `Art ${id}`,
  scientificName: "Aves",
  rarity: 5,
  photoUrl: null,
  ...over,
})
const ids = (items: { id: string }[]) => items.map((item) => item.id)
const many = (n: number) => Array.from({ length: n }, (_, i) => larm(String(i)))

describe("digestDay", () => {
  it("hides nothing on an ordinary day", () => {
    const { highlights, rest } = digestDay(many(8))
    expect(highlights).toHaveLength(8)
    expect(rest).toEqual([])
  })

  it("keeps six on a busy day and loses none", () => {
    const { highlights, rest } = digestDay(many(40))
    expect(highlights).toHaveLength(6)
    expect(rest).toHaveLength(34)
  })

  it("chooses notable birds, then photos, then the newest", () => {
    const alerts = [
      ...many(5),
      larm("foto", { photoUrl: "/f" }),
      larm("ovanlig", { rarity: 2 }),
      larm("sällsynt", { rarity: 0 }),
      larm("sist"),
    ]
    const { highlights } = digestDay(alerts)
    expect(ids(highlights)).toEqual(["0", "1", "2", "foto", "ovanlig", "sällsynt"])
    expect(ids(highlights)).not.toContain("3")
  })

  it("keeps the log's order among the highlights", () => {
    const alerts = [...many(9), larm("gammal", { rarity: 0 })]
    expect(ids(digestDay(alerts).highlights).at(-1)).toBe("gammal")
  })
})

describe("speciesCount", () => {
  it("counts birds once each", () => {
    expect(
      speciesCount([
        larm("a", { species: "Skata" }),
        larm("b", { species: "Skata" }),
        larm("c", { species: "Övrigt (ej fågel)", scientificName: "" }),
      ])
    ).toBe(1)
  })
})

describe("pageOfDays", () => {
  const on = (id: string, day: number) => larm(id, { observedAt: `2026-10-${day}T12:00:00Z` })
  const cursor = (a: ReturnType<typeof on>) => ({ observedAt: a.observedAt, id: a.id })

  it("gives a day cut off at the end to the next page", () => {
    const a = on("a", 31)
    const b = on("b", 30)
    const c = on("c", 29)
    const page = pageOfDays({ alerts: [a, b, c], older: cursor(c), newer: null }, "older", 4)
    expect(page.days.map((d) => ids(d.items))).toEqual([["a"], ["b"]])
    expect(page.older).toEqual(cursor(b))
  })

  it("keeps the last day when nothing older exists", () => {
    const a = on("a", 31)
    const b = on("b", 30)
    const page = pageOfDays({ alerts: [a, b], older: null, newer: null }, "older", 4)
    expect(page.days).toHaveLength(2)
    expect(page.older).toBeNull()
  })

  it("stops at the day limit and can carry on from there", () => {
    const rows = [on("a", 28), on("b", 27), on("c", 26)]
    const page = pageOfDays({ alerts: rows, older: null, newer: null }, "older", 2)
    expect(page.days).toHaveLength(2)
    expect(page.older?.id).toBe("b")
  })

  it("keeps a day bigger than the page", () => {
    const a = on("a", 31)
    const b = on("b", 31)
    const page = pageOfDays({ alerts: [a, b], older: cursor(b), newer: null }, "older", 4)
    expect(page.days).toHaveLength(1)
    expect(page.older).toEqual(cursor(b))
  })

  it("cuts the newer end when paging back towards today", () => {
    const a = on("a", 31)
    const b = on("b", 30)
    const page = pageOfDays({ alerts: [a, b], older: cursor(b), newer: cursor(a) }, "newer", 4)
    expect(page.days.map((d) => ids(d.items))).toEqual([["b"]])
    expect(page.newer).toEqual(cursor(b))
  })

  it("offers nothing newer once paging back has reached today", () => {
    const rows = [on("a", 31), on("b", 30)]
    const page = pageOfDays({ alerts: rows, older: cursor(on("b", 30)), newer: null }, "newer", 2)
    expect(page.days).toHaveLength(2)
    expect(page.newer).toBeNull()
  })

  it("can carry on towards today when the day limit cut the page", () => {
    const rows = [on("a", 31), on("b", 30), on("c", 29)]
    const page = pageOfDays({ alerts: rows, older: cursor(on("c", 29)), newer: null }, "newer", 2)
    expect(page.days.map((d) => ids(d.items))).toEqual([["b"], ["c"]])
    expect(page.newer?.id).toBe("b")
  })
})
