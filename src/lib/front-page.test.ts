import { describe, expect, it } from "vitest"

import {
  buildDayList,
  latestPrints,
  namedSpecies,
  pickLead,
  splitFeatured,
  splitLarm,
  withoutPhoto,
} from "./front-page"
import type { RarityLevel } from "./rarity"
import type { TeaserImage } from "./teaser"

const photo = (width: number, height: number): TeaserImage => ({
  src: "",
  srcset: "",
  width,
  height,
  alt: "",
})
const landscape = photo(1600, 1067)
const portrait = photo(1536, 2048)

const article = (id: number, image: TeaserImage | null) => ({ id, image })
const ids = (items: { id: number }[]) => items.map((item) => item.id)

describe("pickLead", () => {
  it("leads with the newest when it has a large landscape photo", () => {
    const { lead, rest } = pickLead([article(1, landscape), article(2, landscape)])
    expect(lead?.id).toBe(1)
    expect(ids(rest)).toEqual([2])
  })

  it("leads with the newest even when an older article has a better photo", () => {
    const articles = [
      article(1, null),
      article(2, portrait),
      article(3, landscape),
      article(4, null),
    ]
    const { lead, rest } = pickLead(articles)
    expect(lead?.id).toBe(1)
    expect(ids(rest)).toEqual([2, 3, 4])
  })

  it("has no lead when there are no articles", () => {
    expect(pickLead([])).toEqual({ lead: null, rest: [] })
  })
})

describe("splitFeatured", () => {
  it("takes the first articles with a photo as tiles and keeps the rest in order", () => {
    const articles = [
      article(1, null),
      article(2, portrait),
      article(3, landscape),
      article(4, null),
      article(5, landscape),
      article(6, landscape),
    ]
    const { tiles, list } = splitFeatured(articles, 3)
    expect(ids(tiles)).toEqual([2, 3, 5])
    expect(ids(list)).toEqual([1, 4, 6])
  })

  it("doesn't repeat a photo among the tiles", () => {
    const shared = { ...landscape, src: "same.webp" }
    const { tiles, list } = splitFeatured(
      [article(1, shared), article(2, shared), article(3, { ...landscape, src: "other.webp" })],
      3
    )
    expect(ids(tiles)).toEqual([1, 3])
    expect(ids(list)).toEqual([2])
  })

  it("makes no tiles when nothing has a photo", () => {
    const { tiles, list } = splitFeatured([article(1, null), article(2, null)], 3)
    expect(tiles).toEqual([])
    expect(ids(list)).toEqual([1, 2])
  })
})

describe("withoutPhoto", () => {
  const shared = { ...landscape, src: "lead.webp" }
  it("takes the lead's photo from an article repeating it", () => {
    const [same, other] = withoutPhoto([article(1, shared), article(2, landscape)], "lead.webp")
    expect(same?.image).toBeNull()
    expect(other?.image).toBe(landscape)
  })

  it("changes nothing without a lead photo", () => {
    const articles = [article(1, shared)]
    expect(withoutPhoto(articles, null)).toBe(articles)
  })
})

describe("buildDayList", () => {
  const now = new Date("2026-10-31T17:00:00Z")
  const larm = (id: string, species: string, observedAt: string, rarity: RarityLevel = 5) => ({
    id,
    species,
    scientificName: species === "Övrigt (ej fågel)" ? "" : "Aves",
    rarity,
    observedAt,
  })
  const names = (list: ReturnType<typeof buildDayList>) => list?.species.map((s) => s.name)

  it("lists each species once, linking to its newest larm", () => {
    const list = buildDayList(
      [larm("a", "Blåmes", "2026-10-31T15:00:00Z"), larm("b", "Blåmes", "2026-10-31T09:00:00Z")],
      now
    )
    expect(list?.species).toEqual([{ name: "Blåmes", alertId: "a", notable: false }])
    expect(list?.isToday).toBe(true)
  })

  it("puts the most notable first and keeps the rest newest first", () => {
    const list = buildDayList(
      [
        larm("a", "Skata", "2026-10-31T15:00:00Z"),
        larm("b", "Mandarinand", "2026-10-31T14:00:00Z", 2),
        larm("c", "Blåmes", "2026-10-31T13:00:00Z"),
        larm("d", "Kungsörn", "2026-10-31T12:00:00Z", 0),
      ],
      now
    )
    expect(names(list)).toEqual(["Kungsörn", "Mandarinand", "Skata", "Blåmes"])
    expect(list?.species.map((s) => s.notable)).toEqual([true, true, false, false])
  })

  it("leaves out what isn't a bird", () => {
    const list = buildDayList(
      [
        larm("a", "Övrigt (ej fågel)", "2026-10-31T15:00:00Z"),
        larm("b", "Skata", "2026-10-31T14:00:00Z"),
      ],
      now
    )
    expect(names(list)).toEqual(["Skata"])
  })

  it("keeps to one Stockholm day, whose midnight isn't UTC's", () => {
    const list = buildDayList(
      [larm("a", "Skata", "2026-10-30T23:30:00Z"), larm("b", "Blåmes", "2026-10-30T22:30:00Z")],
      now
    )
    // 00:30 on the 31st in Stockholm, and 23:30 on the 30th.
    expect(names(list)).toEqual(["Skata"])
    expect(list?.isToday).toBe(true)
  })

  it("falls back to the last day with larm, and says it isn't today", () => {
    const list = buildDayList([larm("a", "Skata", "2026-10-29T10:00:00Z")], now)
    expect(names(list)).toEqual(["Skata"])
    expect(list?.isToday).toBe(false)
  })

  it("still names the last day after a quiet spell, and nothing with no larm", () => {
    const list = buildDayList([larm("a", "Skata", "2026-07-03T10:00:00Z")], now)
    expect(names(list)).toEqual(["Skata"])
    expect(list?.isToday).toBe(false)
    expect(buildDayList([], now)).toBeNull()
  })
})

describe("latestPrints", () => {
  const now = new Date("2026-10-31T12:00:00Z")
  const larm = (id: number, photo: boolean, observedAt = "2026-10-30T12:00:00Z") => ({
    id,
    observedAt,
    photoUrl: photo ? `/${id}` : null,
  })
  it("reaches past a run of photo-less larm, keeping the order", () => {
    const alerts = [larm(1, false), larm(2, true), larm(3, false), larm(4, true), larm(5, true)]
    expect(ids(latestPrints(alerts, 2, now))).toEqual([2, 4])
  })
  it("leaves out a photo older than a month", () => {
    const alerts = [larm(1, true), larm(2, true, "2026-09-20T12:00:00Z")]
    expect(ids(latestPrints(alerts, 5, now))).toEqual([1])
  })
  it("is empty when nothing has a photo", () => {
    expect(latestPrints([larm(1, false)], 5, now)).toEqual([])
  })
})

describe("namedSpecies", () => {
  const one = (name: string, notable = false) => ({ name, alertId: name, notable })
  const names = (list: { name: string }[]) => list.map((s) => s.name)
  it("names every species on a quiet day", () => {
    expect(names(namedSpecies([one("a"), one("b"), one("c")]))).toEqual(["a", "b", "c"])
  })
  it("names only the notable on a big day, and at most two", () => {
    const big = [one("a", true), one("b", true), one("c", true), one("d")]
    expect(names(namedSpecies(big))).toEqual(["a", "b"])
    expect(namedSpecies([one("a"), one("b"), one("c"), one("d")])).toEqual([])
  })
})

describe("splitLarm", () => {
  const larm = (id: number, withPhoto: boolean) => ({
    id,
    photoUrl: withPhoto ? `/larm/bild/${id}` : null,
  })

  it("prints the newest photos and lists every photo-less larm newer than the last print", () => {
    const alerts = [
      larm(1, false),
      larm(2, true),
      larm(3, false),
      larm(4, false),
      larm(5, true),
      larm(6, false),
      larm(7, true),
    ]
    const { prints, plain } = splitLarm(alerts, 2)
    expect(ids(prints)).toEqual([2, 5])
    expect(ids(plain)).toEqual([1, 3, 4])
  })

  it("doesn't cap the plain list, so nothing newer is hidden", () => {
    const alerts = [1, 2, 3, 4, 5, 6].map((id) => larm(id, false)).concat(larm(7, true))
    const { prints, plain } = splitLarm(alerts, 5)
    expect(ids(prints)).toEqual([7])
    expect(ids(plain)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it("lists the newest few when there are no photos at all", () => {
    const alerts = [1, 2, 3, 4, 5].map((id) => larm(id, false))
    expect(splitLarm(alerts, 3)).toEqual({ prints: [], plain: alerts.slice(0, 3) })
  })
})
