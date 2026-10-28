import { describe, expect, it } from "vitest"

import { pickLead, splitFeatured, splitLarm } from "./front-page"
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

  it("makes no tiles when nothing has a photo", () => {
    const { tiles, list } = splitFeatured([article(1, null), article(2, null)], 3)
    expect(tiles).toEqual([])
    expect(ids(list)).toEqual([1, 2])
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
