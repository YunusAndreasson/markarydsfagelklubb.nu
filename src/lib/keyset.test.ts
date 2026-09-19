import { describe, expect, it } from "vitest"

import { decodeCursor, encodeCursor, newerThan, olderThan } from "./keyset"

const cursor = { publishedAt: "2026-09-19T20:38:47.123456+00:00", id: 42 }

describe("cursors", () => {
  it("round-trip without losing the microseconds", () => {
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor)
    const viaUrl = new URLSearchParams({ fore: encodeCursor(cursor) }).toString()
    expect(decodeCursor(new URLSearchParams(viaUrl).get("fore"))).toEqual(cursor)
  })

  it("reject anything else, so a query string can't inject a filter", () => {
    for (const bad of [
      null,
      "",
      "42",
      "2026-09-19~42",
      "2026-09-19T20:38:47Z~0",
      "2026-09-19T20:38:47Z~-1",
      "2026-09-19T20:38:47Z~4x",
      '2026-09-19T20:38:47Z",id.gt.0~1',
    ]) {
      expect(decodeCursor(bad), String(bad)).toBeNull()
    }
  })
})

describe("filters", () => {
  it("page by (published_at, id), quoting the timestamp", () => {
    expect(olderThan(cursor)).toBe(
      'published_at.lt."2026-09-19T20:38:47.123456+00:00",and(published_at.eq."2026-09-19T20:38:47.123456+00:00",id.lt.42)'
    )
    expect(newerThan(cursor)).toBe(
      'published_at.gt."2026-09-19T20:38:47.123456+00:00",and(published_at.eq."2026-09-19T20:38:47.123456+00:00",id.gt.42)'
    )
  })
})
