import { toStockholmInputValue } from "./stockholm-time"

/**
 * The program as an iCalendar feed (RFC 5545), served at /kalender.ics so a
 * member can subscribe once and see the club's events in their own calendar.
 *
 * Pure, and tested, because the format is unforgiving in ways a browser never
 * shows you: lines end with CRLF, a line longer than 75 **octets** is folded,
 * and `;` `,` `\` and newlines inside a text value have to be escaped. A feed
 * that gets one of those wrong is rejected whole by some clients and silently
 * truncated by others.
 */

export type FeedEvent = {
  id: number
  slug: string
  title: string
  summary: string
  place: string
  starts_at: string
  ends_at: string | null
  all_day: boolean
  updated_at: string
}

export type CalendarOptions = {
  /** The site's own origin, e.g. "https://mafk-web.jonas-268.workers.dev". */
  origin: string
  now: Date
}

const CALENDAR_NAME = "Markaryds Fågelklubb"
const PRODUCT_ID = "-//Markaryds Fagelklubb//mafk-web//SV"

/** RFC 5545: "lines of text SHOULD NOT be longer than 75 octets". */
const MAX_OCTETS = 75

function octetsOf(char: string): number {
  const code = char.codePointAt(0) ?? 0
  if (code < 0x80) return 1
  if (code < 0x800) return 2
  if (code < 0x10000) return 3
  return 4
}

/**
 * Fold one content line. Continuation lines begin with a single space, which
 * counts towards their own 75, and the split is by code point so å and ö never
 * come apart.
 */
export function foldLine(line: string): string {
  const lines: string[] = []
  let current = ""
  let octets = 0
  for (const char of line) {
    const size = octetsOf(char)
    const limit = lines.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1
    if (octets + size > limit) {
      lines.push(current)
      current = ""
      octets = 0
    }
    current += char
    octets += size
  }
  lines.push(current)
  return lines.join("\r\n ")
}

/** Escape a TEXT value. The backslash goes first, or it would escape itself. */
export function escapeText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
}

/** "20261003T160000Z" — an instant, in UTC, as the format wants it. */
function utcStamp(value: Date | string): string {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
}

/** "20261003" — the Swedish calendar date an instant falls on. */
function dateValue(value: Date | string): string {
  return toStockholmInputValue(value).slice(0, 10).replaceAll("-", "")
}

/** The day after, for an all-day DTEND, which is exclusive. */
function dayAfter(value: Date | string): string {
  const day = new Date(`${toStockholmInputValue(value).slice(0, 10)}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() + 1)
  return day.toISOString().slice(0, 10).replaceAll("-", "")
}

function line(name: string, value: string): string {
  return `${name}:${escapeText(value)}`
}

function eventLines(event: FeedEvent, options: CalendarOptions, host: string): string[] {
  const url = `${options.origin}/kalender/${event.slug}`
  const lines = [
    "BEGIN:VEVENT",
    // Stable for the life of the row, so re-subscribing updates rather than
    // duplicating. The id never changes; the slug may.
    `UID:event-${event.id}@${host}`,
    `DTSTAMP:${utcStamp(options.now)}`,
    `LAST-MODIFIED:${utcStamp(event.updated_at)}`,
  ]

  if (event.all_day) {
    lines.push(`DTSTART;VALUE=DATE:${dateValue(event.starts_at)}`)
    lines.push(`DTEND;VALUE=DATE:${dayAfter(event.ends_at ?? event.starts_at)}`)
  } else {
    lines.push(`DTSTART:${utcStamp(event.starts_at)}`)
    // No end time is left as no DTEND: RFC 5545 reads that as an event that
    // ends when it starts. Inventing a length would put a wrong time in
    // someone's calendar.
    if (event.ends_at) lines.push(`DTEND:${utcStamp(event.ends_at)}`)
  }

  lines.push(line("SUMMARY", event.title))
  if (event.place) lines.push(line("LOCATION", event.place))
  // Some clients show DESCRIPTION and ignore URL, so the link goes in both.
  lines.push(line("DESCRIPTION", event.summary ? `${event.summary}\n\n${url}` : url))
  lines.push(`URL:${url}`)
  lines.push("END:VEVENT")
  return lines
}

export function renderCalendar(events: FeedEvent[], options: CalendarOptions): string {
  const host = URL.canParse(options.origin) ? new URL(options.origin).host : "markarydsfagelklubb"
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODUCT_ID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    line("X-WR-CALNAME", CALENDAR_NAME),
    "X-WR-TIMEZONE:Europe/Stockholm",
    ...events.flatMap((event) => eventLines(event, options, host)),
    "END:VCALENDAR",
  ]
  // A trailing CRLF: every content line ends with one, the last included.
  return `${lines.map(foldLine).join("\r\n")}\r\n`
}
