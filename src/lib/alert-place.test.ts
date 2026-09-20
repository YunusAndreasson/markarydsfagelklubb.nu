import { describe, expect, it } from "vitest"

import {
  type AlertPoint,
  coarsePlace,
  distanceKm,
  isInsideKommun,
  KOMMUN_PLACE,
  type NamedLocation,
  nearestLocation,
  OUTSIDE_PLACE,
  PLACE_SUPPRESSED_SPECIES,
  UNKNOWN_PLACE,
} from "./alert-place"

/** Three of the club's real lokaler, enough to exercise every rung. */
const locations: NamedLocation[] = [
  { name: "Hualtet", latitude: 56.48974, longitude: 13.63176 },
  { name: "Reningsdammarna", latitude: 56.47344, longitude: 13.58119 },
  { name: "Klintbadet", latitude: 56.54696, longitude: 13.72453 },
]

const point = (latitude: number | null, longitude: number | null): AlertPoint => ({
  location_name: null,
  latitude,
  longitude,
  species_id: 1,
})

describe("isInsideKommun", () => {
  it("accepts places that really are in the kommun", () => {
    for (const [name, lat, lng] of [
      ["Markaryd centrum", 56.4604, 13.5936],
      ["Strömsnäsbruk", 56.5561, 13.7139],
      ["Traryd", 56.5872, 13.7519],
      ["Timsfors", 56.4869, 13.5836],
    ] as const) {
      expect(isInsideKommun(lat, lng), name).toBe(true)
    }
  })

  it("rejects the neighbours, so a bird seen in Älmhult isn't claimed as ours", () => {
    for (const [name, lat, lng] of [
      ["Älmhult", 56.5517, 14.1362],
      ["Ljungby", 56.8333, 13.9406],
      ["Hässleholm", 56.1589, 13.7667],
      ["Osby", 56.3833, 13.9944],
    ] as const) {
      expect(isInsideKommun(lat, lng), name).toBe(false)
    }
  })

  it("rejects the far-away larm the live data actually contains", () => {
    expect(isInsideKommun(55.58173, 13.02267), "Malmö").toBe(false)
    expect(isInsideKommun(53.27044, -6.20498), "Dublin").toBe(false)
  })

  it("keeps the three exclaves, which a coarser polygon would have swallowed", () => {
    for (const [lat, lng] of [
      [56.49758, 13.7763],
      [56.65315, 13.60756],
      [56.66007, 13.59535],
    ] as const) {
      expect(isInsideKommun(lat, lng), `${lat},${lng}`).toBe(true)
    }
  })

  it("treats a non-finite coordinate as outside rather than throwing", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isInsideKommun(bad, 13.5936), String(bad)).toBe(false)
      expect(isInsideKommun(56.4604, bad), String(bad)).toBe(false)
    }
  })
})

describe("distanceKm", () => {
  it("measures a known short hop", () => {
    // Markaryd tätort → Timsfors, about 3 km up the valley.
    expect(distanceKm(56.4596, 13.592, 56.4871, 13.6112)).toBeCloseTo(3.28, 1)
  })

  it("is zero for a point against itself", () => {
    expect(distanceKm(56.4604, 13.5936, 56.4604, 13.5936)).toBe(0)
  })
})

describe("nearestLocation", () => {
  it("picks the closest lokal", () => {
    const nearest = nearestLocation(56.48762, 13.64466, locations)
    expect(nearest?.name).toBe("Hualtet")
    expect(nearest?.km).toBeCloseTo(0.83, 1)
  })

  it("skips a lokal with no coordinate instead of ranking it at null island", () => {
    const nearest = nearestLocation(56.4604, 13.5936, [
      { name: "Utan position", latitude: null, longitude: null },
      ...locations,
    ])
    expect(nearest?.name).toBe("Reningsdammarna")
  })

  it("returns null when no lokal has a coordinate", () => {
    expect(nearestLocation(56.4604, 13.5936, [])).toBeNull()
    expect(
      nearestLocation(56.4604, 13.5936, [
        { name: "Utan position", latitude: null, longitude: null },
      ])
    ).toBeNull()
  })
})

describe("coarsePlace", () => {
  it("uses the lokal the reporter chose", () => {
    const alert = { ...point(56.48762, 13.64466), location_name: "Hammarsjön" }
    expect(coarsePlace(alert, locations)).toBe("Hammarsjön")
  })

  it("ignores a blank lokal name rather than printing an empty place", () => {
    const alert = { ...point(56.48762, 13.64466), location_name: "   " }
    expect(coarsePlace(alert, locations)).toBe("Nära Hualtet")
  })

  it("names the nearest lokal for a free pin, which is most of the live data", () => {
    expect(coarsePlace(point(56.48762, 13.64466), locations)).toBe("Nära Hualtet")
  })

  it("falls back to the kommun when no lokal is close enough to describe the spot", () => {
    // Inside the kommun, 6.5 km from the nearest lokal.
    expect(coarsePlace(point(56.62811, 13.49277), locations)).toBe(KOMMUN_PLACE)
  })

  it("says so plainly when the larm is from somewhere else entirely", () => {
    expect(coarsePlace(point(55.58173, 13.02267), locations)).toBe(OUTSIDE_PLACE)
    expect(coarsePlace(point(53.27044, -6.20498), locations)).toBe(OUTSIDE_PLACE)
  })

  it("handles the one live larm that carries no coordinate at all", () => {
    expect(coarsePlace(point(null, null), locations)).toBe(UNKNOWN_PLACE)
  })

  it("drops even the lokal name for a protected species", () => {
    const suppressed = PLACE_SUPPRESSED_SPECIES as Set<number>
    suppressed.add(4242)
    try {
      const atLokal: AlertPoint = {
        location_name: "Hammarsjön",
        latitude: 56.54261,
        longitude: 13.72467,
        species_id: 4242,
      }
      expect(coarsePlace(atLokal, locations)).toBe(KOMMUN_PLACE)
      expect(coarsePlace({ ...atLokal, species_id: 1 }, locations)).toBe("Hammarsjön")

      // …and never claims the kommun for one seen somewhere else.
      const abroad: AlertPoint = { ...atLokal, latitude: 53.27044, longitude: -6.20498 }
      expect(coarsePlace(abroad, locations)).toBe(OUTSIDE_PLACE)
    } finally {
      suppressed.delete(4242)
    }
  })

  it("never returns a coordinate, on any rung", () => {
    const cases: AlertPoint[] = [
      { ...point(56.48762, 13.64466), location_name: "Hammarsjön" },
      point(56.48762, 13.64466),
      point(56.62811, 13.49277),
      point(55.58173, 13.02267),
      point(null, null),
    ]
    for (const alert of cases) {
      const label = coarsePlace(alert, locations)
      // A place name never contains a decimal number; a leaked lat/lng always does.
      expect(label, JSON.stringify(alert)).not.toMatch(/\d+[.,]\d/)
      for (const value of [alert.latitude, alert.longitude]) {
        if (value !== null) expect(label, String(value)).not.toContain(String(value))
      }
    }
  })
})
