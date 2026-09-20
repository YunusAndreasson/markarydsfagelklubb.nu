import { describe, expect, it } from "vitest"

import { escapeText, type FeedEvent, foldLine, renderCalendar } from "./ical"

const options = { origin: "https://example.test", now: new Date("2026-09-20T08:00:00Z") }

const event = (overrides: Partial<FeedEvent> = {}): FeedEvent => ({
  id: 7,
  slug: "ugglespaning",
  title: "Ugglespaning",
  summary: "Samling vid kyrkan.",
  place: "Ekebacken",
  starts_at: "2026-10-03T16:00:00Z",
  ends_at: null,
  all_day: false,
  updated_at: "2026-09-19T10:00:00Z",
  ...overrides,
})

/** The feed as a client reads it: unfolded content lines, CRLF removed. */
function lines(feed: string): string[] {
  return feed.replace(/\r\n /g, "").split("\r\n").slice(0, -1)
}

describe("escapeText", () => {
  it("escapes what the format reserves", () => {
    expect(escapeText("a;b,c\\d")).toBe("a\\;b\\,c\\\\d")
  })

  it("escapes the backslash before the rest, not after", () => {
    // "\;" must become "\\\;" — a literal backslash, then an escaped semicolon.
    expect(escapeText("\\;")).toBe("\\\\\\;")
  })

  it("turns every newline into the two-character escape", () => {
    expect(escapeText("en\r\ntvå\ntre\rfyra")).toBe("en\\ntvå\\ntre\\nfyra")
  })

  it("leaves Swedish letters alone", () => {
    expect(escapeText("Fågelholkar i Älmhult")).toBe("Fågelholkar i Älmhult")
  })
})

describe("foldLine", () => {
  it("leaves a short line as it is", () => {
    expect(foldLine("SUMMARY:Möte")).toBe("SUMMARY:Möte")
  })

  it("folds at 75 octets, with a space starting each continuation", () => {
    const folded = foldLine(`SUMMARY:${"a".repeat(100)}`)
    const parts = folded.split("\r\n")
    expect(parts[0]).toHaveLength(75)
    expect(parts[1]?.startsWith(" ")).toBe(true)
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"a".repeat(100)}`)
  })

  it("counts octets, not characters, so an å is two", () => {
    const folded = foldLine(`SUMMARY:${"å".repeat(50)}`)
    const first = folded.split("\r\n")[0] ?? ""
    const octets = new TextEncoder().encode(first).length
    expect(octets).toBeLessThanOrEqual(75)
    // 8 ASCII + 33 å = 74 octets; a 34th would make 76.
    expect(first).toBe(`SUMMARY:${"å".repeat(33)}`)
  })

  it("never splits a character in half", () => {
    const folded = foldLine(`SUMMARY:${"ö".repeat(200)}`)
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"ö".repeat(200)}`)
    for (const part of folded.split("\r\n")) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    }
  })
})

describe("renderCalendar", () => {
  it("wraps the events in a calendar", () => {
    const feed = renderCalendar([event()], options)
    expect(lines(feed).slice(0, 7)).toEqual([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Markaryds Fagelklubb//mafk-web//SV",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Markaryds Fågelklubb",
      "X-WR-TIMEZONE:Europe/Stockholm",
    ])
    expect(lines(feed).at(-1)).toBe("END:VCALENDAR")
  })

  it("ends every line with CRLF, the last one included", () => {
    const feed = renderCalendar([event()], options)
    expect(feed.endsWith("END:VCALENDAR\r\n")).toBe(true)
    expect(feed.includes("\n\n")).toBe(false)
    // No bare LF anywhere.
    expect(feed.replace(/\r\n/g, "")).not.toContain("\n")
  })

  it("writes a timed event as an instant in UTC", () => {
    const feed = lines(renderCalendar([event()], options))
    expect(feed).toContain("DTSTART:20261003T160000Z")
    expect(feed.some((l) => l.startsWith("DTEND"))).toBe(false)
  })

  it("keeps summer and winter time apart", () => {
    // 18:00 Swedish time is 16:00 UTC in October and 17:00 UTC in December.
    const summer = lines(renderCalendar([event({ starts_at: "2026-07-03T16:00:00Z" })], options))
    expect(summer).toContain("DTSTART:20260703T160000Z")
    const allDayWinter = lines(
      renderCalendar([event({ starts_at: "2026-12-31T23:30:00Z", all_day: true })], options)
    )
    // 23:30 UTC on 31 December is already 1 January in Stockholm.
    expect(allDayWinter).toContain("DTSTART;VALUE=DATE:20270101")
    expect(allDayWinter).toContain("DTEND;VALUE=DATE:20270102")
  })

  it("gives an all-day event an exclusive end on the following day", () => {
    const feed = lines(
      renderCalendar([event({ starts_at: "2026-10-02T22:00:00Z", all_day: true })], options)
    )
    expect(feed).toContain("DTSTART;VALUE=DATE:20261003")
    expect(feed).toContain("DTEND;VALUE=DATE:20261004")
  })

  it("ends a multi-day all-day event the day after it finishes", () => {
    const feed = lines(
      renderCalendar(
        [
          event({
            starts_at: "2026-10-02T22:00:00Z",
            ends_at: "2026-10-04T22:00:00Z",
            all_day: true,
          }),
        ],
        options
      )
    )
    expect(feed).toContain("DTSTART;VALUE=DATE:20261003")
    expect(feed).toContain("DTEND;VALUE=DATE:20261006")
  })

  it("writes an end time when there is one", () => {
    const feed = lines(renderCalendar([event({ ends_at: "2026-10-03T19:00:00Z" })], options))
    expect(feed).toContain("DTEND:20261003T190000Z")
  })

  it("identifies an event by its id, which never changes", () => {
    const feed = lines(renderCalendar([event({ slug: "annat-namn" })], options))
    expect(feed).toContain("UID:event-7@example.test")
  })

  it("carries the title, the place and a link", () => {
    const feed = lines(renderCalendar([event()], options))
    expect(feed).toContain("SUMMARY:Ugglespaning")
    expect(feed).toContain("LOCATION:Ekebacken")
    expect(feed).toContain("URL:https://example.test/kalender/ugglespaning")
    expect(feed).toContain(
      "DESCRIPTION:Samling vid kyrkan.\\n\\nhttps://example.test/kalender/ugglespaning"
    )
  })

  it("leaves out what is empty, rather than printing a blank line", () => {
    const feed = lines(renderCalendar([event({ place: "", summary: "" })], options))
    expect(feed.some((l) => l.startsWith("LOCATION"))).toBe(false)
    expect(feed).toContain("DESCRIPTION:https://example.test/kalender/ugglespaning")
  })

  it("escapes a title that would otherwise break the line", () => {
    const feed = lines(renderCalendar([event({ title: "Möte; med fika, kl 19" })], options))
    expect(feed).toContain("SUMMARY:Möte\\; med fika\\, kl 19")
  })

  it("renders an empty program as a valid, empty calendar", () => {
    expect(lines(renderCalendar([], options))).toEqual([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Markaryds Fagelklubb//mafk-web//SV",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Markaryds Fågelklubb",
      "X-WR-TIMEZONE:Europe/Stockholm",
      "END:VCALENDAR",
    ])
  })

  it("pairs every BEGIN:VEVENT with an END:VEVENT", () => {
    const feed = lines(renderCalendar([event(), event({ id: 8, slug: "b" })], options))
    expect(feed.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(2)
    expect(feed.filter((l) => l === "END:VEVENT")).toHaveLength(2)
  })
})
