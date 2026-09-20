import { describe, expect, it } from "vitest"
import {
  buildLokaler,
  byName,
  findLokal,
  type LokalRow,
  lokalSlug,
  registerLetter,
  toPin,
} from "./lokal"

const row = (id: number, name: string, extra: Partial<LokalRow> = {}): LokalRow => ({
  id,
  name,
  latitude: 56.5,
  longitude: 13.6,
  description: null,
  ...extra,
})

describe("lokalSlug", () => {
  it("writes the club's real names the way WordPress would", () => {
    expect(lokalSlug("Köphultasjön")).toBe("kophultasjon")
    expect(lokalSlug("Skararps ängar")).toBe("skararps-angar")
    expect(lokalSlug("Trösklen/Lillåns våtmarker")).toBe("trosklen-lillans-vatmarker")
    expect(lokalSlug("Marebro / Strömmabäcken")).toBe("marebro-strommabacken")
    expect(lokalSlug("Jacobssons udde")).toBe("jacobssons-udde")
  })
})

describe("buildLokaler", () => {
  it("gives every lokal a slug and keeps the caller's order", () => {
    const lokaler = buildLokaler([row(3, "Hualtet"), row(1, "Byasjön")])
    expect(lokaler.map((l) => l.name)).toEqual(["Hualtet", "Byasjön"])
    expect(lokaler.map((l) => l.slug)).toEqual(["hualtet", "byasjon"])
  })

  it("lets the older lokal keep the bare slug when two names collide", () => {
    const lokaler = buildLokaler([row(4, "Hualtet"), row(9, "Hualtét")])
    expect(findLokal("hualtet", lokaler)?.id).toBe(4)
    expect(findLokal("hualtet-9", lokaler)?.id).toBe(9)
  })

  it("resolves a collision the same way whatever order the rows arrive in", () => {
    const rows = [row(4, "Hualtet"), row(9, "Hualtét")]
    const forwards = buildLokaler(rows)
    const backwards = buildLokaler([...rows].reverse())
    const slugOf = (lokaler: ReturnType<typeof buildLokaler>, id: number) =>
      lokaler.find((l) => l.id === id)?.slug
    expect(slugOf(forwards, 4)).toBe(slugOf(backwards, 4))
    expect(slugOf(forwards, 9)).toBe(slugOf(backwards, 9))
  })

  it("never hands out a segment the site owns, or an empty one", () => {
    const lokaler = buildLokaler([row(2, "Lokaler"), row(5, "???"), row(7, "Admin")])
    expect(lokaler.map((l) => l.slug)).toEqual(["lokal-2", "lokal-5", "lokal-7"])
  })

  it("produces a unique slug per lokal", () => {
    const lokaler = buildLokaler([
      row(1, "Ängabäck"),
      row(2, "Ängabäcks kraftstation"),
      row(3, "Ängabäcks ängar"),
      row(4, "Tröskeln"),
      row(5, "Trösklen/Lillåns våtmarker"),
    ])
    expect(new Set(lokaler.map((l) => l.slug)).size).toBe(lokaler.length)
  })
})

describe("toPin", () => {
  const summary = {
    ...row(1, "Hualtet"),
    slug: "hualtet",
    alertCount: 3,
    lastAlertAt: "2026-09-12T08:00:00Z",
    active: true,
  }

  it("publishes only what the map needs to draw a dot", () => {
    expect(toPin(summary)).toEqual({
      slug: "hualtet",
      name: "Hualtet",
      latitude: 56.5,
      longitude: 13.6,
      active: true,
    })
  })

  it("has no pin for a lokal without a position", () => {
    expect(toPin({ ...summary, latitude: null, longitude: null })).toBeNull()
  })
})

describe("the register's order", () => {
  it("files å, ä and ö at the end, as Swedish sorts them", () => {
    const names = ["Ängabäck", "Byasjön", "Åmot", "Anderslöv", "Örnafälla"]
    expect([...names].sort((a, b) => byName({ name: a }, { name: b }))).toEqual([
      "Anderslöv",
      "Byasjön",
      "Åmot",
      "Ängabäck",
      "Örnafälla",
    ])
  })

  it("heads each name with its own letter, so Ä is not filed under A", () => {
    expect(registerLetter("Ängabäck")).toBe("Ä")
    expect(registerLetter("Åmot")).toBe("Å")
    expect(registerLetter("Örnafälla")).toBe("Ö")
    expect(registerLetter("hualtet")).toBe("H")
  })
})
