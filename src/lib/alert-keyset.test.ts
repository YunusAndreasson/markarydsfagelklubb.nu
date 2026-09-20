import { describe, expect, it } from "vitest"

import {
  type AlertCursor,
  decodeAlertCursor,
  encodeAlertCursor,
  newerThan,
  olderThan,
} from "./alert-keyset"

const cursor: AlertCursor = {
  sentAt: "2026-09-19T05:14:11.401+00:00",
  id: "1f1c0f3a-9d1e-4a6b-9a8e-0c2c5b1a7f42",
}

describe("cursors", () => {
  it("survives a round trip", () => {
    expect(decodeAlertCursor(encodeAlertCursor(cursor))).toEqual(cursor)
  })

  it("keeps the timestamp exactly as PostgREST wrote it", () => {
    // Re-parsing through Date would drop the .401 and shuffle larm sent in the
    // same second across the page boundary.
    expect(encodeAlertCursor(cursor)).toContain("2026-09-19T05:14:11.401+00:00")
  })

  it("accepts the shapes PostgREST actually returns", () => {
    for (const sentAt of [
      "2026-09-19T05:14:11.401+00:00",
      "2026-09-19T05:14:11Z",
      "2026-09-19T05:14:11.4+02:00",
      "2026-09-19T05:14:11.401337+00:00",
    ]) {
      expect(decodeAlertCursor(`${sentAt}~${cursor.id}`), sentAt).toEqual({ sentAt, id: cursor.id })
    }
  })

  it("rejects anything else, so a query string can't inject a filter", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "not-a-cursor",
      `${cursor.sentAt}`,
      `~${cursor.id}`,
      `2026-09-19~${cursor.id}`,
      `${cursor.sentAt}~not-a-uuid`,
      `${cursor.sentAt}~1f1c0f3a9d1e4a6b9a8e0c2c5b1a7f42`,
      `${cursor.sentAt}~${cursor.id},or(id.gt.0)`,
      `${cursor.sentAt}~${cursor.id}"`,
      `2026-09-19T05:14:11.401+00:00' or '1'='1~${cursor.id}`,
    ]) {
      expect(decodeAlertCursor(bad), String(bad)).toBeNull()
    }
  })

  it("splits on the last separator, so a stray one can't shift the id", () => {
    expect(decodeAlertCursor(`${cursor.sentAt}~${cursor.id}~`)).toBeNull()
  })
})

describe("filters", () => {
  it("quotes the timestamp, which PostgREST needs for ':' '.' and '+'", () => {
    expect(olderThan(cursor)).toContain(`"${cursor.sentAt}"`)
    expect(newerThan(cursor)).toContain(`"${cursor.sentAt}"`)
  })

  it("breaks a tie on id, so two larm in the same microsecond both appear once", () => {
    expect(olderThan(cursor)).toBe(
      `sent_at.lt."${cursor.sentAt}",and(sent_at.eq."${cursor.sentAt}",id.lt.${cursor.id})`
    )
    expect(newerThan(cursor)).toBe(
      `sent_at.gt."${cursor.sentAt}",and(sent_at.eq."${cursor.sentAt}",id.gt.${cursor.id})`
    )
  })

  it("points the two directions at opposite halves of the list", () => {
    expect(olderThan(cursor)).toContain("sent_at.lt.")
    expect(newerThan(cursor)).toContain("sent_at.gt.")
  })
})
