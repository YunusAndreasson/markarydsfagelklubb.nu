import { describe, expect, it } from "vitest"
import type { Sighting } from "./artportalen/types"
import { reportLokalId, reportsByLokal, summarizeReports } from "./lokal-reports"

const sighting = (name: string, start: string, position: Sighting["position"]): Sighting => ({
  id: `${name}-${start}`,
  url: null,
  speciesId: 1,
  name,
  sci: "",
  start,
  timed: true,
  count: 1,
  countText: null,
  activity: null,
  locality: null,
  observers: null,
  position,
})

// Hydroviken, and a lokal 600 m east of it; a degree of longitude here is about 61.5 km.
const hydroviken = { id: 1, latitude: 56.4635, longitude: 13.6 }
const east = { id: 2, latitude: 56.4635, longitude: 13.6098 }
const lokaler = [hydroviken, east, { id: 3, latitude: null, longitude: null }]

describe("reportLokalId", () => {
  it("places a report at the nearest lokal within a kilometre", () => {
    const west = sighting("brunand", "2026-11-12T08:00:00+01:00", {
      latitude: 56.4635,
      longitude: 13.597,
      metres: 25,
    })
    expect(reportLokalId(west, lokaler)).toBe(1)
    const between = sighting("brunand", "2026-11-12T08:00:00+01:00", {
      latitude: 56.4635,
      longitude: 13.607,
      metres: 25,
    })
    expect(reportLokalId(between, lokaler)).toBe(2)
  })

  it("places nothing that is far off, vague or without a position", () => {
    const far = { latitude: 56.4635, longitude: 13.64, metres: 25 }
    expect(reportLokalId(sighting("a", "2026-11-12", far), lokaler)).toBeNull()
    const town = { latitude: 56.4635, longitude: 13.6, metres: 2311 }
    expect(reportLokalId(sighting("a", "2026-11-12", town), lokaler)).toBeNull()
    expect(reportLokalId(sighting("a", "2026-11-12", null), lokaler)).toBeNull()
    expect(reportLokalId(sighting("a", "2026-11-12", undefined), lokaler)).toBeNull()
  })
})

describe("reportsByLokal and summarizeReports", () => {
  it("keeps the newest first and names each species once", () => {
    const at = { latitude: 56.4635, longitude: 13.6, metres: 10 }
    const reports = [
      sighting("sångsvan", "2026-11-14T09:00:00+01:00", at),
      sighting("bläsand", "2026-11-13T09:00:00+01:00", at),
      sighting("sångsvan", "2026-11-12T09:00:00+01:00", at),
    ]
    const byLokal = reportsByLokal(reports, lokaler)
    expect(byLokal.get(1)?.length).toBe(3)
    expect(summarizeReports(byLokal.get(1))).toEqual({
      count: 3,
      last: "2026-11-14T09:00:00+01:00",
      species: ["sångsvan", "bläsand"],
    })
    expect(summarizeReports(byLokal.get(2))).toBeNull()
  })
})
