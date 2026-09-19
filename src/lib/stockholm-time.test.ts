import { describe, expect, it } from "vitest"

import {
  formatDate,
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
  })

  it("puts a post just after midnight on the right day and year", () => {
    expect(formatDate("2025-12-31T23:30:00Z", "long")).toBe("1 januari 2026")
    expect(stockholmYear("2025-12-31T23:30:00Z")).toBe(2026)
  })
})
