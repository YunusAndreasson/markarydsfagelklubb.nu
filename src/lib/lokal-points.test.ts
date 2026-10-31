import { describe, expect, it } from "vitest"

import { type LokalPointRow, orderPoints, pointsToFrame, splitForLokal } from "./lokal-points"

const row = (over: Partial<LokalPointRow> & { id: number }): LokalPointRow => ({
  location_id: 1,
  linked_location_id: null,
  kind: "place",
  name: `Plats ${over.id}`,
  note: "",
  latitude: 56.5,
  longitude: 13.5,
  sort_order: over.id,
  ...over,
})

describe("orderPoints", () => {
  it("puts the practical first and numbers down the page", () => {
    const points = orderPoints([row({ id: 1 }), row({ id: 2, kind: "practical" }), row({ id: 3 })])
    expect(points.map((point) => [point.id, point.number])).toEqual([
      [2, 1],
      [1, 2],
      [3, 3],
    ])
  })

  it("gives no number to what has no position, without leaving a gap", () => {
    const points = orderPoints([
      row({ id: 1, kind: "practical", latitude: null, longitude: null }),
      row({ id: 2 }),
    ])
    expect(points.map((point) => point.number)).toEqual([null, 1])
  })
})

describe("splitForLokal", () => {
  it("tells this lokal's places from its being a place elsewhere", () => {
    const rows = [
      row({ id: 1, location_id: 7 }),
      row({ id: 2, location_id: 9, linked_location_id: 7, name: "Rallvägen" }),
    ]
    const { own, partOf } = splitForLokal(rows, 7)
    expect(own.map((point) => point.id)).toEqual([1])
    expect(partOf?.location_id).toBe(9)
  })

  it("has neither for an ordinary lokal", () => {
    expect(splitForLokal([], 7)).toEqual({ own: [], partOf: null })
  })
})

describe("pointsToFrame", () => {
  const center = { latitude: 56.4738, longitude: 13.5793 }
  const at = (latitude: number) => ({ latitude, longitude: 13.5793 })

  it("frames every place when there are few", () => {
    const points = [at(56.474), at(56.4459)]
    expect(pointsToFrame(points, center)).toEqual(points)
  })

  it("leaves the furthest out when there are many", () => {
    const near = Array.from({ length: 7 }, (_, i) => at(56.474 + i / 10000))
    const far = [at(56.4459), at(56.5), at(56.44)]
    const framed = pointsToFrame([...far, ...near], center)
    expect(framed).toHaveLength(7)
    expect(framed).not.toContainEqual(at(56.4459))
  })
})
