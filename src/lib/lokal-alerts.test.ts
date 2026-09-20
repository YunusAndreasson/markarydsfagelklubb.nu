import { describe, expect, it } from "vitest"
import { NEAR_KM } from "./alert-place"
import {
  ACTIVE_DAYS,
  AT_LOKAL_KM,
  classifyForLokal,
  homeLokalId,
  type LarmPoint,
  type LokalPoint,
  lokalActivity,
  nearBox,
} from "./lokal-alerts"

/** Hualtet, one of the club's real lokaler. */
const HUALTET: LokalPoint = { id: 12, latitude: 56.489737, longitude: 13.631756 }

/** A second lokal two kilometres north: far enough not to disturb the rungs below. */
const FAR: LokalPoint = { id: 13, latitude: 56.489737 + 2 / 111.32, longitude: 13.631756 }

const ALL = [HUALTET, FAR]

/** Metres north of Hualtet, which keeps the arithmetic obvious. */
const north = (metres: number, rest: Partial<LarmPoint> = {}): LarmPoint => ({
  sent_at: "2026-09-12T08:00:00+00:00",
  latitude: (HUALTET.latitude as number) + metres / 111_320,
  longitude: HUALTET.longitude as number,
  location_id: null,
  ...rest,
})

describe("classifyForLokal", () => {
  it("counts a larm inside 300 m as sent from the lokal", () => {
    expect(classifyForLokal(HUALTET, north(0), ALL)).toBe("at")
    expect(classifyForLokal(HUALTET, north(AT_LOKAL_KM * 1000 - 10), ALL)).toBe("at")
  })

  it("counts one just outside 300 m as near, not at", () => {
    expect(classifyForLokal(HUALTET, north(AT_LOKAL_KM * 1000 + 10), ALL)).toBe("near")
    expect(classifyForLokal(HUALTET, north(NEAR_KM * 1000 - 100), ALL)).toBe("near")
  })

  it("stops caring past three kilometres", () => {
    expect(classifyForLokal(HUALTET, north(NEAR_KM * 1000 + 100), ALL)).toBe("elsewhere")
    expect(classifyForLokal(HUALTET, north(400_000), ALL)).toBe("elsewhere")
  })

  it("believes the reporter over the coordinate", () => {
    // Named this lokal from four kilometres away: still sent from it.
    expect(classifyForLokal(HUALTET, north(4_000, { location_id: HUALTET.id }), ALL)).toBe("at")
    // Named a different lokal while standing on this one: not this one's larm,
    // but still near enough to show under "I närheten".
    expect(classifyForLokal(HUALTET, north(0, { location_id: FAR.id }), ALL)).toBe("near")
  })

  it("has nothing to say about a larm or a lokal without a position", () => {
    expect(classifyForLokal(HUALTET, north(0, { latitude: null, longitude: null }), ALL)).toBe(
      "elsewhere"
    )
    // A lokal the club has not placed yet: no larm can be measured against it,
    // and only a reporter naming it explicitly can put one on its page.
    const unplaced: LokalPoint = { id: 99, latitude: null, longitude: null }
    expect(classifyForLokal(unplaced, north(0), [...ALL, unplaced])).toBe("elsewhere")
    expect(classifyForLokal(unplaced, north(0, { location_id: 99 }), [...ALL, unplaced])).toBe("at")
  })
})

describe("homeLokalId — nearest wins, and only one wins", () => {
  /** Two lokaler 150 m apart, like Tröskeln and Trösklen/Lillåns våtmarker (52 m). */
  const A: LokalPoint = { id: 1, latitude: 56.4, longitude: 13.6 }
  const B: LokalPoint = { id: 2, latitude: 56.4 + 150 / 111_320, longitude: 13.6 }
  const pair = [A, B]
  const between = (metres: number): LarmPoint => ({
    sent_at: "2026-09-12T08:00:00+00:00",
    latitude: (A.latitude as number) + metres / 111_320,
    longitude: 13.6,
    location_id: null,
  })

  it("gives a larm between two lokaler to the closer one, never to both", () => {
    // 40 m from A, 110 m from B: inside 300 m of each, but it is A's larm.
    expect(homeLokalId(between(40), pair)).toBe(A.id)
    expect(classifyForLokal(A, between(40), pair)).toBe("at")
    expect(classifyForLokal(B, between(40), pair)).toBe("near")
  })

  it("gives it to the other one once that is closer", () => {
    expect(homeLokalId(between(110), pair)).toBe(B.id)
  })

  it("gives it to nobody when no lokal is within 300 m", () => {
    expect(homeLokalId(between(900), pair)).toBeNull()
  })

  it("takes the reporter's lokal even when another is nearer", () => {
    expect(homeLokalId({ ...between(40), location_id: B.id }, pair)).toBe(B.id)
  })
})

describe("lokalActivity", () => {
  const now = new Date("2026-09-20T12:00:00Z")
  const at = (sentAt: string, metres = 0): LarmPoint => north(metres, { sent_at: sentAt })

  it("counts the larm sent from the lokal, and not the ones merely near it", () => {
    const activity = lokalActivity(
      HUALTET,
      [
        at("2026-09-18T08:00:00+00:00"),
        // Two kilometres away: on the page under "I närheten", never in the tally.
        at("2026-09-19T08:00:00+00:00", 2_000),
        at("2026-09-02T08:00:00+00:00", 40_000),
      ],
      ALL,
      now
    )
    expect(activity.alertCount).toBe(1)
    // The nearby larm is the newest of the three and must not become "senast".
    expect(activity.lastAlertAt).toBe("2026-09-18T08:00:00+00:00")
  })

  it("is active while a larm is inside the fortnight, and quiet after it", () => {
    const justInside = new Date(now.getTime() - (ACTIVE_DAYS - 1) * 86_400_000).toISOString()
    const justOutside = new Date(now.getTime() - (ACTIVE_DAYS + 1) * 86_400_000).toISOString()
    expect(lokalActivity(HUALTET, [at(justInside)], ALL, now).active).toBe(true)
    expect(lokalActivity(HUALTET, [at(justOutside)], ALL, now).active).toBe(false)
  })

  it("reports a lokal nobody has larmed from as empty, not as broken", () => {
    expect(lokalActivity(HUALTET, [], ALL, now)).toEqual({
      alertCount: 0,
      lastAlertAt: null,
      active: false,
    })
  })

  it("never returns a coordinate, whatever it was given", () => {
    const activity = lokalActivity(HUALTET, [at("2026-09-18T08:00:00+00:00")], ALL, now)
    const published = JSON.stringify(activity)
    expect(published).not.toContain("56.4")
    expect(published).not.toContain("13.6")
    expect(Object.keys(activity).sort()).toEqual(["active", "alertCount", "lastAlertAt"])
  })
})

describe("nearBox", () => {
  it("contains every point the circular test can accept", () => {
    const box = nearBox(HUALTET)
    if (!box) throw new Error("Hualtet has a position")
    for (const metres of [0, 1_000, NEAR_KM * 1000 - 10]) {
      const point = north(metres)
      expect(point.latitude as number).toBeGreaterThanOrEqual(box.minLat)
      expect(point.latitude as number).toBeLessThanOrEqual(box.maxLat)
    }
    // Generous on purpose: wider than three kilometres, never narrower.
    expect(box.maxLat - (HUALTET.latitude as number)).toBeGreaterThanOrEqual(NEAR_KM / 111.32)
    expect(box.maxLng - (HUALTET.longitude as number)).toBeGreaterThan(NEAR_KM / 111.32)
  })

  it("has no box for a lokal without a position", () => {
    expect(nearBox({ id: 1, latitude: null, longitude: null })).toBeNull()
  })
})
