import type { AlertCursor } from "./alert-keyset"
import { RARITY_WORTH_SAYING } from "./rarity"
import { groupByDay } from "./stockholm-time"

/**
 * How /larm stays short on a day like Smålandsrallyt (docs/design.md,
 * "Stora dagar"). Pure, so the rules are tested rather than buried in a template.
 */

type Larm = {
  id: string
  observedAt: string
  species: string
  scientificName: string
  rarity: number
  photoUrl: string | null
}

/** Up to this many larm a day, every one is shown in full: nothing needs hiding. */
const FULL_DAY = 8
const HIGHLIGHTS = 6

/**
 * A busy day's highlights and the rest. What a member would stop for comes
 * first: the notable birds, then the ones with a photo, then the newest. The
 * highlights then go back to the log's order, so the times still run downwards.
 */
export function digestDay<T extends Larm>(alerts: readonly T[]): { highlights: T[]; rest: T[] } {
  if (alerts.length <= FULL_DAY) return { highlights: [...alerts], rest: [] }
  const score = (alert: T) =>
    (alert.rarity <= RARITY_WORTH_SAYING ? 2 : 0) + (alert.photoUrl ? 1 : 0)
  // A stable sort, so a tie keeps the feed's newest-first order.
  const chosen = new Set(
    [...alerts].sort((a, b) => score(b) - score(a) || a.rarity - b.rarity).slice(0, HIGHLIGHTS)
  )
  return {
    highlights: alerts.filter((alert) => chosen.has(alert)),
    rest: alerts.filter((alert) => !chosen.has(alert)),
  }
}

/** The different birds among a day's larm; "Övrigt (ej fågel)" has no scientific name. */
export function speciesCount(alerts: readonly Larm[]): number {
  return new Set(alerts.filter((a) => a.scientificName !== "").map((a) => a.species)).size
}

type Page<T> = { alerts: T[]; older: AlertCursor | null; newer: AlertCursor | null }

const cursorOf = (alert: Larm): AlertCursor => ({ observedAt: alert.observedAt, id: alert.id })

/**
 * Trims a page of larm to whole days, at most `maxDays`, so a day's summary never
 * covers half of it. A read that stopped mid-day gives that day up to the next
 * page, unless it is the only day there: a day bigger than the page still has to
 * show. `paging` says which way the page was read, and so which end may be cut.
 */
export function pageOfDays<T extends Larm>(
  page: Page<T>,
  paging: "older" | "newer",
  maxDays: number
) {
  let days = groupByDay(page.alerts, (alert) => alert.observedAt)
  let { older, newer } = page

  if (paging === "newer") {
    if (newer && days.length > 1) days = days.slice(1)
    const wasLong = days.length > maxDays
    if (wasLong) days = days.slice(-maxDays)
    const first = days[0]?.items[0]
    if (newer || wasLong) newer = first ? cursorOf(first) : null
  } else {
    if (older && days.length > 1) days = days.slice(0, -1)
    const wasLong = days.length > maxDays
    if (wasLong) days = days.slice(0, maxDays)
    const last = days.at(-1)?.items.at(-1)
    if (older || wasLong) older = last ? cursorOf(last) : null
  }
  return { days, older, newer }
}
