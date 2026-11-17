/**
 * Dates as the club reads them: Swedish, in Swedish time.
 *
 * The Worker runs in UTC and the database stores instants, so every date a
 * person types or reads goes through here. No library: Intl knows the
 * Europe/Stockholm rules, including the summer-time changes.
 */

import { capitalize } from "./text"

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
  /** "19": the day of the month alone, set large on a calendar-page date. */
  day: new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE, day: "numeric" }),
  /** "sep": the month beside it. */
  monthShort: new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE, month: "short" }),
  /** "19 sep" */
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
  /** "19 sep 2026 10:05" */
  dateTime: new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }),
} as const

export type DateFormat = keyof typeof FORMATS

/**
 * Intl abbreviates a month with a full stop ("19 sep."). The site writes every
 * short month without one, as Obsar's narrow registers already did, so a date
 * reads the same in a list, the programme and a larm (docs/design.md, "Startsidan").
 */
const ABBREVIATED = new Set<DateFormat>(["monthShort", "short", "dateTime"])

/**
 * A day and its month never break apart ("11 november", "27 nov"): Svenska
 * skrivregler binds a number to the word after it with a no-break space.
 */
const bindNumbers = (text: string) => text.replace(/(\d) (?=\p{L})/gu, "$1\u00a0")

export function formatDate(value: Date | string, format: DateFormat): string {
  const text = FORMATS[format].format(toDate(value))
  return bindNumbers(ABBREVIATED.has(format) ? text.replace(/(\p{L})\.(?=\s|$)/u, "$1") : text)
}

/**
 * When a larm was seen, as a member would say it: "i dag", "i går", else
 * "20 okt" — with the year when it isn't this one. Days are Stockholm days,
 * so the 25-hour night when summer time ends is still one day.
 */
export function dayLabel(value: Date | string, now: Date = new Date()): string {
  const day = startOfStockholmDay(value).getTime()
  const today = startOfStockholmDay(now).getTime()
  if (day === today) return "i dag"
  // Twelve hours before midnight is always inside yesterday, 23 hours long or 25.
  if (day === startOfStockholmDay(new Date(today - 12 * 3_600_000)).getTime()) return "i går"
  const short = formatDate(value, "short")
  const year = stockholmYear(value)
  return year === stockholmYear(now) ? short : `${short} ${year}`
}

/**
 * A day as a heading over a list: "I dag", "I går", else "Fredag 30 oktober",
 * with the year when it isn't this one.
 */
export function dayHeading(value: Date | string, now: Date = new Date()): string {
  const label = dayLabel(value, now)
  if (label === "i dag" || label === "i går") return label === "i dag" ? "I dag" : "I går"
  const heading = capitalize(formatDate(value, "weekday"))
  return stockholmYear(value) === stockholmYear(now)
    ? heading
    : `${heading} ${stockholmYear(value)}`
}

/** Runs of items on the same Stockholm day, in the order they came. */
export function groupByDay<T>(
  items: readonly T[],
  dateOf: (item: T) => Date | string
): { day: string; items: T[] }[] {
  const groups: { key: number; day: string; items: T[] }[] = []
  for (const item of items) {
    const date = dateOf(item)
    const key = startOfStockholmDay(date).getTime()
    const last = groups.at(-1)
    if (last?.key === key) last.items.push(item)
    else groups.push({ key, day: new Date(date).toISOString(), items: [item] })
  }
  return groups.map(({ day, items: dayItems }) => ({ day, items: dayItems }))
}

/** The year in Stockholm: a post at 00:30 on New Year's Day belongs to the new year. */
export function stockholmYear(value: Date | string): number {
  return stockholmParts(toDate(value)).year
}

/** An ISO `datetime` attribute value for `<time>`. */
export function isoDateTime(value: Date | string): string {
  return toDate(value).toISOString()
}

/**
 * The year to print beside a short date, or null: only when it isn't this one.
 * The site's rule everywhere a date leaves its year out ("3 nov", "3 nov 2024").
 */
export function yearUnlessThis(value: Date | string, now: Date = new Date()): number | null {
  const year = stockholmYear(value)
  return year === stockholmYear(now) ? null : year
}

/**
 * A date as the site writes it, in parts (docs/design.md, "Spalterna"): the one
 * place that decides, so a date reads the same in every margin and list. `MarginDate`
 * stacks the parts from md; a row joins them on one line.
 *
 * - "page": the date of a page's own subject, spelled out ("8 november"): an
 *   article, an event, the home page's lead.
 * - "row": an entry in a list, short ("6 nov"): articles, larm, the programme, tiles.
 *
 * The caller adds only what its reader needs: the weekday where the day decides
 * something (the programme, a page), the year where it isn't this one or a page
 * wants it, a time where there is one.
 */
export function dateParts(
  value: Date | string,
  form: "page" | "row",
  extra: { weekday?: boolean; year?: number | string | null; time?: string | null } = {}
): string[] {
  const parts = [
    extra.weekday ? formatDate(value, "weekdayName") : null,
    formatDate(value, form === "page" ? "dayMonth" : "short"),
    extra.year === null || extra.year === undefined ? null : String(extra.year),
    extra.time ?? null,
  ]
  return parts.filter((part): part is string => Boolean(part))
}

/**
 * The year to print on a dated list's row, or null. "changes": on the first row
 * and wherever the year changes from the row above (an archive). "other-years":
 * only on rows that aren't this year (a list that is mostly recent).
 */
export function listYear<T>(
  items: readonly T[],
  index: number,
  dateOf: (item: T) => Date | string,
  mode: "changes" | "other-years",
  now: Date = new Date()
): number | null {
  const item = items[index]
  if (item === undefined) return null
  if (mode === "other-years") return yearUnlessThis(dateOf(item), now)
  const year = stockholmYear(dateOf(item))
  const previous = items[index - 1]
  return previous !== undefined && stockholmYear(dateOf(previous)) === year ? null : year
}
