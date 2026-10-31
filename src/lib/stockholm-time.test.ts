import { describe, expect, it } from "vitest"

import {
  dayHeading,
  dayLabel,
  formatDate,
  groupByDay,
  parseStockholmInputValue,
  stockholmYear,
  toStockholmInputValue,
} from "./stockholm-time"

describe("parseStockholmInputValue", () => {
  it("reads winter time as UTC+1 and summer time as UTC+2", () => {
    expect(parseStockholmInputValue("2026-01-15T10:00")?.toISOString()).toBe(
      "2026-01-15T09:00:00.000Z"
    )
    expect(parseStockholmInputValue("2026-07-15T10:00")?.toISOString()).toBe(
      "2026-07-15T08:00:00.000Z"
    )
  })

  it("gets the days of the changes right", () => {
    // Summer time starts 2026-03-29 at 02:00 and ends 2026-10-25 at 03:00.
    expect(parseStockholmInputValue("2026-03-29T01:30")?.toISOString()).toBe(
      "2026-03-29T00:30:00.000Z"
    )
    expect(parseStockholmInputValue("2026-03-29T03:30")?.toISOString()).toBe(
      "2026-03-29T01:30:00.000Z"
    )
    expect(parseStockholmInputValue("2026-10-25T04:00")?.toISOString()).toBe(
      "2026-10-25T03:00:00.000Z"
    )
  })

  it("moves a time the spring change skips forward instead of failing", () => {
    const skipped = parseStockholmInputValue("2026-03-29T02:30")
    expect(skipped && toStockholmInputValue(skipped)).toBe("2026-03-29T03:30")
  })

  it("resolves the repeated autumn hour to one that round-trips", () => {
    const repeated = parseStockholmInputValue("2026-10-25T02:30")
    expect(repeated && toStockholmInputValue(repeated)).toBe("2026-10-25T02:30")
  })

  it("rejects values that aren't a real date and time", () => {
    for (const bad of [
      "",
      "2026-02-30T10:00",
      "2026-13-01T10:00",
      "2026-01-01T24:00",
      "2026-01-01",
      "igår",
    ]) {
      expect(parseStockholmInputValue(bad), bad).toBeNull()
    }
  })

  it("round-trips through the input value", () => {
    for (const value of ["2026-01-01T00:00", "2026-06-21T23:59", "2027-12-31T12:30"]) {
      const parsed = parseStockholmInputValue(value)
      expect(parsed && toStockholmInputValue(parsed)).toBe(value)
    }
  })
})

describe("formatDate", () => {
  const date = "2026-09-19T08:05:00Z"

  it("writes dates the Swedish way, in Swedish time", () => {
    expect(formatDate(date, "long")).toBe("19 september 2026")
    expect(formatDate(date, "weekday")).toBe("lördag 19 september")
    expect(formatDate(date, "short")).toBe("19 sep.")
    expect(formatDate(date, "weekdayName")).toBe("lördag")
    expect(formatDate(date, "dayMonth")).toBe("19 september")
    expect(formatDate(date, "dateTime")).toBe("19 sep. 2026 10:05")
    expect(formatDate(date, "clock")).toBe("10:05")
  })

  it("shows a larm's clock time on the 24-hour scale the club uses", () => {
    expect(formatDate("2026-09-19T05:14:00Z", "clock")).toBe("07:14")
    // Midnight is 00:00, never 24:00 — sv-SE's default without hourCycle h23.
    expect(formatDate("2026-09-18T22:00:00Z", "clock")).toBe("00:00")
  })

  it("puts a post just after midnight on the right day and year", () => {
    expect(formatDate("2025-12-31T23:30:00Z", "long")).toBe("1 januari 2026")
    expect(stockholmYear("2025-12-31T23:30:00Z")).toBe(2026)
  })
})

describe("dayLabel", () => {
  // Saturday 24 October 2026, 10:00 in Stockholm (summer time, UTC+2).
  const now = new Date("2026-10-24T08:00:00Z")

  it("says i dag and i går by the Stockholm calendar, not by 24 hours", () => {
    expect(dayLabel("2026-10-23T22:30:00Z", now)).toBe("i dag") // 00:30 today
    expect(dayLabel("2026-10-23T21:59:00Z", now)).toBe("i går") // 23:59 yesterday
    expect(dayLabel("2026-10-22T22:00:00Z", now)).toBe("i går") // 00:00 yesterday
    expect(dayLabel("2026-10-22T21:59:00Z", now)).toBe("22 okt.") // 23:59 the day before
  })

  it("survives the night summer time ends", () => {
    // Monday 26 October, 00:30 (UTC+1). Sunday 25 October was 25 hours long.
    const monday = new Date("2026-10-25T23:30:00Z")
    expect(dayLabel("2026-10-24T22:00:00Z", monday)).toBe("i går") // Sunday 00:00, UTC+2
    expect(dayLabel("2026-10-25T22:59:00Z", monday)).toBe("i går") // Sunday 23:59, UTC+1
    expect(dayLabel("2026-10-24T21:59:00Z", monday)).toBe("24 okt.") // Saturday 23:59
  })

  it("adds the year only when it isn't this one", () => {
    const newYear = new Date("2027-01-01T09:00:00Z")
    expect(dayLabel("2026-12-31T12:00:00Z", newYear)).toBe("i går")
    expect(dayLabel("2026-12-30T12:00:00Z", newYear)).toBe("30 dec. 2026")
    expect(dayLabel("2026-10-01T12:00:00Z", now)).toBe("1 okt.")
  })
})

describe("dayHeading", () => {
  const now = new Date("2026-10-31T17:00:00Z")
  it("names the near days as a member would", () => {
    expect(dayHeading("2026-10-31T06:00:00Z", now)).toBe("I dag")
    expect(dayHeading("2026-10-30T06:00:00Z", now)).toBe("I går")
  })
  it("spells out the rest, with the year only when it differs", () => {
    expect(dayHeading("2026-10-29T06:00:00Z", now)).toBe("Torsdag 29 oktober")
    expect(dayHeading("2025-10-29T06:00:00Z", now)).toBe("Onsdag 29 oktober 2025")
  })
})

describe("groupByDay", () => {
  it("splits at Stockholm's midnight, keeping the order", () => {
    const groups = groupByDay(
      ["2026-10-30T23:30:00Z", "2026-10-30T22:30:00Z", "2026-10-30T10:00:00Z"],
      (date) => date
    )
    expect(groups.map((group) => group.items.length)).toEqual([1, 2])
  })
  it("has no groups for no items", () => {
    expect(groupByDay([], (date: string) => date)).toEqual([])
  })
})
