import { distanceKm } from "./alert-place"
import type { Sighting } from "./artportalen/types"

/**
 * Artportalen's reports at the club's lokaler (2026-11-17): the last month of
 * reports in the kommun (`Recent` in KV), each placed at the lokal nearest to
 * it within a kilometre.
 *
 * Distance, not the place name: Artportalen's sites are named by whoever made
 * them ("Dammarna, Örnafälla, Tånnerydsdammen"), and the club's lokaler by the
 * app, so the names rarely match. A lokal is a single point, and a report from
 * the far shore of its lake is still a report from the lokal, hence a kilometre
 * rather than the 300 m a larm gets.
 *
 * As with larm (`homeLokalId`), the nearest lokal wins and only one does: six
 * pairs of lokaler are within 200 m of each other, and a report counted at both
 * would be counted twice.
 */

/** How far a report may be from a lokal and still be "at" it. */
export const REPORT_KM = 1

/**
 * A report whose own position is vaguer than this is placed nowhere. A report
 * filed as "Markaryd" carries the whole town's 2 km and could be at any of a
 * dozen lokaler.
 */
export const TRUSTED_METRES = 1000

/** How many species a lokal's line names, newest first. */
export const REPORT_SPECIES = 5

export type ReportLokal = { id: number; latitude: number | null; longitude: number | null }

/** The lokal a report was made at, or null. */
export function reportLokalId(report: Sighting, lokaler: readonly ReportLokal[]): number | null {
  const at = report.position
  if (!at || (at.metres !== null && at.metres > TRUSTED_METRES)) return null
  let best: { id: number; km: number } | null = null
  for (const lokal of lokaler) {
    if (lokal.latitude === null || lokal.longitude === null) continue
    const km = distanceKm(lokal.latitude, lokal.longitude, at.latitude, at.longitude)
    if (km <= REPORT_KM && (!best || km < best.km)) best = { id: lokal.id, km }
  }
  return best?.id ?? null
}

/** Each lokal's reports, in the order given (Recent is newest first). */
export function reportsByLokal(
  reports: readonly Sighting[],
  lokaler: readonly ReportLokal[]
): Map<number, Sighting[]> {
  const out = new Map<number, Sighting[]>()
  for (const report of reports) {
    const id = reportLokalId(report, lokaler)
    if (id === null) continue
    const list = out.get(id)
    if (list) list.push(report)
    else out.set(id, [report])
  }
  return out
}

export type LokalReports = {
  count: number
  /** ISO start of the newest report. */
  last: string
  /** The species reported, newest first, at most {@link REPORT_SPECIES}. */
  species: string[]
}

/** What the register prints for a lokal's reports; null when there are none. */
export function summarizeReports(reports: readonly Sighting[] | undefined): LokalReports | null {
  const first = reports?.[0]
  if (!reports || !first) return null
  const species = [...new Set(reports.map((one) => one.name))].slice(0, REPORT_SPECIES)
  return { count: reports.length, last: first.start, species }
}
