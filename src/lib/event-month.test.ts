import { describe, expect, it } from "vitest"

import {
  groupByMonth,
  monthKey,
  monthOf,
  monthRange,
  parseMonthKey,
  shiftMonth,
} from "./event-month"

describe("parseMonthKey", () => {
  it("reads a month page's path segment", () => {
    expect(parseMonthKey("2026-10")).toEqual({ year: 2026, month: 10 })
    expect(parseMonthKey("2026-01")).toEqual({ year: 2026, month: 1 })
    expect(parseMonthKey("2026-12")).toEqual({ year: 2026, month: 12 })
  })

  it("rejects anything that isn't one, so an event slug falls through to the event", () => {
    for (const bad of [
      undefined,
      "",
      "2026-13",
      "2026-00",
      "2026-1",
      "26-10",
      "2026-10-03",
      "ugglespaning",
      "1999-10",
      "2101-10",
    ]) {
      expect(parseMonthKey(bad), String(bad)).toBeNull()
    }
  })

  it("round-trips through the key", () => {
    for (const key of ["2026-01", "2026-09", "2030-12"]) {
      const month = parseMonthKey(key)
      expect(month && monthKey(month)).toBe(key)
    }
  })
})

describe("shiftMonth", () => {
  it("steps within a year", () => {
    expect(shiftMonth({ year: 2026, month: 9 }, 1)).toEqual({ year: 2026, month: 10 })
    expect(shiftMonth({ year: 2026, month: 9 }, -1)).toEqual({ year: 2026, month: 8 })
  })

  it("crosses the year boundary in both directions", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
  })
})

describe("monthRange", () => {
  it("runs from midnight to midnight, Swedish time", () => {
    // Winter: Stockholm is UTC+1, so the month starts at 23:00 the day before.
    expect(monthRange({ year: 2026, month: 1 }).start.toISOString()).toBe(
      "2025-12-31T23:00:00.000Z"
    )
    expect(monthRange({ year: 2026, month: 1 }).end.toISOString()).toBe("2026-01-31T23:00:00.000Z")
    // Summer: UTC+2.
    expect(monthRange({ year: 2026, month: 7 }).start.toISOString()).toBe(
      "2026-06-30T22:00:00.000Z"
    )
  })

  it("keeps a month with a summer-time change the right length", () => {
    // Summer time starts 2026-03-29: March is 31 days but one hour shorter.
    const march = monthRange({ year: 2026, month: 3 })
    const hours = (march.end.getTime() - march.start.getTime()) / 3_600_000
    expect(hours).toBe(31 * 24 - 1)
    // And it ends 2026-10-25, which makes October one hour longer.
    const october = monthRange({ year: 2026, month: 10 })
    expect((october.end.getTime() - october.start.getTime()) / 3_600_000).toBe(31 * 24 + 1)
  })

  it("ends December on the first instant of January", () => {
    expect(monthRange({ year: 2026, month: 12 }).end.toISOString()).toBe("2026-12-31T23:00:00.000Z")
  })
})

describe("monthOf", () => {
  it("uses the Swedish month, not UTC's", () => {
    // 23:30 UTC on 31 October is already November in Stockholm.
    expect(monthOf("2026-10-31T23:30:00Z")).toEqual({ year: 2026, month: 11 })
    expect(monthOf("2026-10-31T21:30:00Z")).toEqual({ year: 2026, month: 10 })
  })
})

describe("groupByMonth", () => {
  const at = (starts_at: string) => ({ starts_at })

  it("keeps the order and starts a group when the month changes", () => {
    const groups = groupByMonth([
      at("2026-10-03T16:00:00Z"),
      at("2026-10-15T17:00:00Z"),
      at("2026-11-01T10:00:00Z"),
      at("2027-01-05T10:00:00Z"),
    ])
    expect(groups.map((group) => group.key)).toEqual(["2026-10", "2026-11", "2027-01"])
    expect(groups[0]?.events).toHaveLength(2)
    expect(groups[0]?.month).toEqual({ year: 2026, month: 10 })
  })

  it("groups by the Swedish month, so a late-evening event counts as the next day's", () => {
    const groups = groupByMonth([at("2026-10-31T23:30:00Z")])
    expect(groups[0]?.key).toBe("2026-11")
  })

  it("has nothing to group in an empty programme", () => {
    expect(groupByMonth([])).toEqual([])
  })
})
