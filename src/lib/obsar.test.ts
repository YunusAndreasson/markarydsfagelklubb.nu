import { describe, expect, it } from "vitest"

import { groupObsar, obsarDescription } from "./obsar"

const entry = (title: string, description = "") => ({ title, description })

describe("groupObsar", () => {
  it("sorts by what a member came to do, keeping the tree's order", () => {
    const groups = groupObsar(
      ["Rapportera på Artportalen", "Årslista 2026", "Blekinge", "Markarydslistan", "Öland"].map(
        (t) => entry(t)
      )
    )
    expect(groups.report.map((e) => e.title)).toEqual(["Rapportera på Artportalen"])
    expect(groups.kommun.map((e) => e.title)).toEqual(["Årslista 2026", "Markarydslistan"])
    expect(groups.regions.map((e) => e.title)).toEqual(["Blekinge", "Öland"])
  })

  it("keeps a link it doesn't recognise", () => {
    expect(groupObsar([entry("Nytt")]).kommun).toHaveLength(1)
  })
})

describe("obsarDescription", () => {
  it("prefers what the admin wrote", () => {
    expect(obsarDescription(entry("Årslista 2026", "Egen text"))).toBe("Egen text")
  })

  it("keeps working when the year in a title changes", () => {
    expect(obsarDescription(entry("Årslista 2031"))).toContain("i år")
  })

  it("says nothing about what it doesn't know", () => {
    expect(obsarDescription(entry("Nytt"))).toBe("")
  })
})
