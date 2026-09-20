import { startOfStockholmMonth, stockholmMonthKey } from "./stockholm-time"

/**
 * The calendar's month pages, `/kalender/2026-10`.
 *
 * A month key is a path segment, so it has to be read the way the article
 * slugs are: checked before anything reaches the database. "2026-10" is also a
 * valid slug shape, which is why `parseEventForm` refuses to give an event
 * that name — the two would collide on the same route.
 */

export type Month = { year: number; month: number }

/** The window a month page reads: `start <= starts_at < end`. */
export type MonthRange = { start: Date; end: Date }

export const MONTH_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/

/** How far the club plans ahead, and how far back the pages walk. */
const FIRST_YEAR = 2000
const LAST_YEAR = 2100

/** A `YYYY-MM` path segment, or null for anything else. */
export function parseMonthKey(value: string | undefined): Month | null {
  const match = MONTH_KEY_PATTERN.exec(value ?? "")
  if (!match) return null
  const year = Number(match[1])
  if (year < FIRST_YEAR || year > LAST_YEAR) return null
  return { year, month: Number(match[2]) }
}

export function monthKey({ year, month }: Month): string {
  return `${year}-${String(month).padStart(2, "0")}`
}

/** The month an instant falls in, in Swedish time. */
export function monthOf(value: Date | string): Month {
  // Formatting and parsing keep one implementation of the time zone rules.
  return parseMonthKey(stockholmMonthKey(value)) ?? { year: FIRST_YEAR, month: 1 }
}

/** December rolls into the next year, January back into the previous one. */
export function shiftMonth({ year, month }: Month, step: number): Month {
  const zeroBased = year * 12 + (month - 1) + step
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 }
}

/**
 * Midnight at the start of the month, and midnight at the start of the next
 * one. Both are real instants, so a month that contains a summer-time change
 * is still exactly its own days long.
 */
export function monthRange(month: Month): MonthRange {
  const next = shiftMonth(month, 1)
  return {
    start: startOfStockholmMonth(month.year, month.month),
    end: startOfStockholmMonth(next.year, next.month),
  }
}

/** Whether a month page exists to link to. */
export function isWithinRange({ year }: Month): boolean {
  return year >= FIRST_YEAR && year <= LAST_YEAR
}
