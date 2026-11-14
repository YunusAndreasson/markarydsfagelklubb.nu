import { describe, expect, it } from "vitest"

import { osmLink, toLarmPins } from "./larm-map"
import type { RarityLevel } from "./rarity"

const larm = (
  id: string,
  species: string,
  observedAt: string,
  position: { latitude: number; longitude: number } | null,
  rarity: RarityLevel = 5
) => ({ id, species, observedAt, position, rarity })

const GARDEN = { latitude: 56.46123, longitude: 13.59877 }
const LAKE = { latitude: 56.48974, longitude: 13.63176 }

describe("toLarmPins", () => {
  it("draws larm from the very same point as one pin, newest first", () => {
    const pins = toLarmPins([
      larm("a", "Blåmes", "2026-11-14T07:00:00Z", GARDEN),
      larm("b", "Domherre", "2026-11-14T09:00:00Z", GARDEN),
      larm("c", "Storskrake", "2026-11-14T08:00:00Z", LAKE),
    ])
    expect(pins).toHaveLength(2)
    const garden = pins.find((pin) => pin.latitude === GARDEN.latitude)
    expect(garden?.alerts.map((alert) => alert.id)).toEqual(["b", "a"])
  })

  it("leaves out a larm without a position, as a protected species has", () => {
    expect(toLarmPins([larm("a", "Berguv", "2026-11-14T07:00:00Z", null)])).toEqual([])
  })

  it("puts rare pins last, so they are drawn on top", () => {
    const pins = toLarmPins([
      larm("a", "Mandarinand", "2026-11-14T07:00:00Z", GARDEN, 1),
      larm("b", "Blåmes", "2026-11-14T08:00:00Z", LAKE),
    ])
    expect(pins.map((pin) => pin.rare)).toEqual([false, true])
  })

  it("carries nothing but the point, the ids, the species and the rarity", () => {
    // A whole DTO goes in, as the pages pass one; only the pin's fields come out.
    const dto = {
      ...larm("a", "Blåmes", "2026-11-14T07:00:00Z", GARDEN),
      observer: "Anna Andersson",
    }
    const [pin] = toLarmPins([dto])
    expect(JSON.stringify(pin)).not.toContain("Anna")
    expect(Object.keys(pin ?? {}).sort()).toEqual(["alerts", "latitude", "longitude", "rare"])
  })
})

describe("osmLink", () => {
  it("opens the exact point with a marker", () => {
    expect(osmLink(GARDEN)).toBe(
      "https://www.openstreetmap.org/?mlat=56.46123&mlon=13.59877#map=16/56.46123/13.59877"
    )
  })
})
