import { describe, expect, it } from "vitest"

import {
  type AppSpecies,
  buildSpecies,
  findBySpelling,
  findSpecies,
  speciesForApp,
  speciesNamed,
  taxonSlugs,
} from "./species"

const app = (
  id: number,
  name: string,
  sci: string,
  rarity: number | null = 5,
  alertCount = 0
): AppSpecies => ({
  id,
  name,
  sci,
  rarity,
  alertCount,
  lastAlertAt: alertCount ? "2026-11-14T08:00:00Z" : null,
})

describe("buildSpecies", () => {
  it("joins on the scientific name, and takes the app's capitalised name and prefix", () => {
    const [one] = buildSpecies(
      [{ id: 100004, name: "kungsfiskare", sci: "Alcedo atthis" }],
      [app(7, "Kungsfiskare", "Alcedo atthis", 2, 3)]
    )
    expect(one).toMatchObject({
      slug: "kungsfiskare",
      name: "Kungsfiskare",
      taxonId: 100004,
      appId: 7,
      rarity: 2,
      alertCount: 3,
    })
  })

  it("falls back to the Swedish name when the taxonomy has moved on", () => {
    const [one] = buildSpecies(
      [{ id: 100001, name: "duvhök", sci: "Astur gentilis" }],
      [app(8, "Duvhök", "Accipiter gentilis", 4)]
    )
    expect(one).toMatchObject({ appId: 8, rarity: 4, sci: "Astur gentilis" })
  })

  it("capitalises an Artportalen-only bird and gives it no prefix, since the club hasn't", () => {
    const [one] = buildSpecies([{ id: 5, name: "rördrom", sci: "Botaurus stellaris" }], [])
    expect(one).toMatchObject({ name: "Rördrom", slug: "rordrom", appId: null, rarity: null })
  })

  it("gives a page to an app species a member has larmed, even if never seen in the kommun", () => {
    const list = buildSpecies(
      [],
      [
        app(1107, "Ökenstenskvätta", "Oenanthe deserti", 1, 1),
        app(1, "Struts", "Struthio camelus", 5, 0),
      ]
    )
    expect(list.map((one) => one.slug)).toEqual(["okenstenskvatta"])
  })

  it("keeps URLs stable on a collision, appending the later one's id", () => {
    const list = buildSpecies(
      [
        { id: 2, name: "gök", sci: "Cuculus canorus" },
        { id: 9, name: "Gök", sci: "Cuculus other" },
      ],
      []
    )
    expect(list.map((one) => one.slug).sort()).toEqual(["gok", "gok-9"])
  })

  it("sorts in Swedish order, with Å, Ä and Ö last", () => {
    const list = buildSpecies(
      [
        { id: 1, name: "ärtsångare", sci: "a" },
        { id: 2, name: "bofink", sci: "b" },
        { id: 3, name: "ormvråk", sci: "c" },
      ],
      []
    )
    expect(list.map((one) => one.name)).toEqual(["Bofink", "Ormvråk", "Ärtsångare"])
  })
})

describe("spellings", () => {
  it("keeps Artportalen's spelling as a second address when the app names the bird differently", () => {
    const list = buildSpecies(
      [{ id: 3, name: "nordlig gulärla", sci: "Motacilla flava thunbergi" }],
      [app(4, "Nordgulärla", "Motacilla flava thunbergi", 3, 1)]
    )
    expect(list[0]?.slug).toBe("nordgularla")
    expect(findBySpelling("nordlig-gularla", list)?.slug).toBe("nordgularla")
    expect(buildSpecies([{ id: 1, name: "gök", sci: "x" }], [])[0]?.altSlug).toBeNull()
  })
})

describe("lookups", () => {
  const list = buildSpecies(
    [{ id: 100004, name: "kungsfiskare", sci: "Alcedo atthis" }],
    [app(7, "Kungsfiskare", "Alcedo atthis", 2, 3)]
  )

  it("finds by slug, app id, name and taxon id", () => {
    expect(findSpecies("kungsfiskare", list)?.appId).toBe(7)
    expect(findSpecies("nope", list)).toBeNull()
    expect(speciesForApp(7, list)?.slug).toBe("kungsfiskare")
    expect(speciesNamed("KUNGSFISKARE", list)?.slug).toBe("kungsfiskare")
    expect(taxonSlugs(list).get(100004)).toBe("kungsfiskare")
  })
})
