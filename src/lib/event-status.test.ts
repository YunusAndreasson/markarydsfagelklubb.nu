import { describe, expect, it } from "vitest"

import { eventStatus, eventStatusLabel, signupOpen, telHref } from "./event-status"

const at = (iso: string) => new Date(iso)

describe("eventStatus", () => {
  const evening = { starts_at: "2026-11-09T17:30:00Z", ends_at: null }
  // As stored: all-day, the last day's Stockholm midnight.
  const rally = { starts_at: "2026-10-30T23:00:00Z", ends_at: "2026-10-31T23:00:00Z" }

  it("follows one evening through its day", () => {
    expect(eventStatus(evening, at("2026-11-08T12:00:00Z"))).toBe("upcoming")
    expect(eventStatus(evening, at("2026-11-09T06:00:00Z"))).toBe("today")
    expect(eventStatus(evening, at("2026-11-09T22:00:00Z"))).toBe("today")
    expect(eventStatus(evening, at("2026-11-10T12:00:00Z"))).toBe("past")
  })

  it("keeps a two-day event on through its last day", () => {
    expect(eventStatus(rally, at("2026-10-31T12:00:00Z"))).toBe("today")
    expect(eventStatus(rally, at("2026-11-01T12:00:00Z"))).toBe("ongoing")
    expect(eventStatus(rally, at("2026-11-01T22:59:00Z"))).toBe("ongoing")
    expect(eventStatus(rally, at("2026-11-01T23:01:00Z"))).toBe("past")
  })

  it("uses Stockholm's midnight, not UTC's", () => {
    expect(eventStatus(evening, at("2026-11-08T23:30:00Z"))).toBe("today")
  })

  it("has words only for what is happening now", () => {
    expect(eventStatusLabel("today")).toBe("I dag")
    expect(eventStatusLabel("ongoing")).toBe("Pågår")
    expect(eventStatusLabel("upcoming")).toBeNull()
    expect(eventStatusLabel("past")).toBeNull()
  })
})

describe("signupOpen", () => {
  const dinner = {
    starts_at: "2026-11-27T17:30:00Z",
    ends_at: null,
    signup_deadline: "2026-11-24",
  }

  it("holds through the last day and closes after it", () => {
    expect(signupOpen(dinner, at("2026-11-24T22:00:00Z"))).toBe(true)
    expect(signupOpen(dinner, at("2026-11-24T23:30:00Z"))).toBe(false)
  })

  it("closes with the event when there is no last day", () => {
    const open = { ...dinner, signup_deadline: null }
    expect(signupOpen(open, at("2026-11-27T12:00:00Z"))).toBe(true)
    expect(signupOpen(open, at("2026-11-28T12:00:00Z"))).toBe(false)
  })
})

describe("telHref", () => {
  it("dials the digits as the club writes them", () => {
    expect(telHref("070-174 06 05")).toBe("tel:070-174 06 05")
    expect(telHref("+46 70 174 06 05")).toBe("tel:+46 70 174 06 05")
    expect(telHref("ring")).toBeNull()
  })
})
