/**
 * Dates as the club reads them: Swedish, in Swedish time.
 *
 * The Worker runs in UTC and the database stores instants, so every date a
 * person types or reads goes through here. No library: Intl knows the
 * Europe/Stockholm rules, including the summer-time changes.
 */

export const TIME_ZONE = "Europe/Stockholm"

type Parts = { year: number; month: number; day: number; hour: number; minute: number }

const PARTS_FORMAT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

function stockholmParts(date: Date): Parts {
  const parts: Record<string, number> = {}
  for (const part of PARTS_FORMAT.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value)
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
  }
}

/** How far Stockholm's wall clock is ahead of UTC at `instant`, in ms. */
function offsetAt(instant: number): number {
  const p = stockholmParts(new Date(instant))
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  return wallAsUtc - Math.floor(instant / 60_000) * 60_000
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

const pad = (n: number) => String(n).padStart(2, "0")

/** The value for an `<input type="datetime-local">`: "2026-09-19T10:05". */
export function toStockholmInputValue(value: Date | string): string {
  const p = stockholmParts(toDate(value))
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

const INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/** The instant a Stockholm wall clock reading names. */
function instantOfWall(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute)
  // Two passes: the offset at the first guess can differ from the offset at
  // the answer when the guess straddles a summer-time change.
  let instant = wallAsUtc - offsetAt(wallAsUtc)
  instant = wallAsUtc - offsetAt(instant)
  return new Date(instant)
}

/**
 * The instant a `datetime-local` value means in Stockholm, or null if it isn't
 * one. A time skipped by the spring change (02:30 on the last Sunday in March)
 * lands an hour later; one repeated in autumn resolves to one of the two, and
 * either round-trips.
 */
export function parseStockholmInputValue(value: string): Date | null {
  const match = INPUT_PATTERN.exec(value.trim())
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ]
  if (month < 1 || month > 12 || hour > 23 || minute > 59) return null
  // Reject 30 February rather than letting Date roll it into March.
  if (new Date(Date.UTC(year, month - 1, day)).getUTCDate() !== day) return null

  return instantOfWall(year, month, day, hour, minute)
}

/**
 * Midnight at the start of the Stockholm day an instant falls in. An all-day
 * event stores that, so "3 oktober" is one instant whatever hour the admin
 * happened to leave in the form.
 */
export function startOfStockholmDay(value: Date | string): Date {
  const p = stockholmParts(toDate(value))
  return instantOfWall(p.year, p.month, p.day, 0, 0)
}

/** The Stockholm month an instant falls in, as "2026-10". */
export function stockholmMonthKey(value: Date | string): string {
  const p = stockholmParts(toDate(value))
  return `${p.year}-${pad(p.month)}`
}

/** Midnight at the start of a Stockholm month, given its year and month. */
export function startOfStockholmMonth(year: number, month: number): Date {
  return instantOfWall(year, month, 1, 0, 0)
}

const FORMATS = {
  /** "19 september 2026" */
  long: new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }),
  /** "lördag 19 september" */
  weekday: new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }),
  /** "lördag" */
  weekdayName: new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE, weekday: "long" }),
  /** "19 september" */
  dayMonth: new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "long",
  }),
  /** "19 sep." */
  short: new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE, day: "numeric", month: "short" }),
  /** "oktober 2026" — the heading over a month of the program. */
  month: new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    month: "long",
    year: "numeric",
  }),
  /** "08:15" — a larm has a time of day; an article doesn't. */
  clock: new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }),
  /** "19 sep. 2026 10:05" */
  dateTime: new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }),
} as const

export type DateFormat = keyof typeof FORMATS

export function formatDate(value: Date | string, format: DateFormat): string {
  return FORMATS[format].format(toDate(value))
}

/** The year in Stockholm: a post at 00:30 on New Year's Day belongs to the new year. */
export function stockholmYear(value: Date | string): number {
  return stockholmParts(toDate(value)).year
}

/** An ISO `datetime` attribute value for `<time>`. */
export function isoDateTime(value: Date | string): string {
  return toDate(value).toISOString()
}
