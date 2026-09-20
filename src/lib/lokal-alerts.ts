import { distanceKm, NEAR_KM } from "./alert-place"

/**
 * Which lokal a larm belongs to (docs/roadmap.md, F5, answered 2026-09-20).
 *
 * Two rules already exist for "where did this happen", and they were written
 * for different jobs:
 *
 *   • The **app** counts a larm toward a lokal within 300 m, or when the
 *     reporter picked the lokal by hand. That is a claim about the bird: at
 *     Hualtet means at Hualtet.
 *   • **This site** labels a larm's place with the nearest lokal within
 *     {@link NEAR_KM} = 3 km ("Nära Hualtet"). That is not a claim about the
 *     bird — it is D1's deliberate blur, which exists so an exact coordinate
 *     never reaches the public.
 *
 * A lokal page that used only the app's rule would drop 133 larm the feed has
 * already labelled with that lokal's name. One that used only the site's rule
 * would tell a reader a bird was at Hualtet when the app says it was 2,8 km
 * away. So the page shows both, under separate headings, and this module is
 * the one place that decides which is which.
 *
 * Like `alert-place.ts`, **nothing here ever returns a coordinate** — the
 * inputs carry them, the outputs are labels, counts and timestamps.
 */

/**
 * How close a larm has to be to count as *at* a lokal, in kilometres.
 *
 * 300 m, mirroring `LOKAL_RADIUS_M` in
 * `../mafk-mobie/src/lib/lokal-proximity.ts`, where the app's own comment
 * records that the figure was measured against the club's 158 pin-drops: it
 * keeps a comfortable margin before the houses 800 m from Hualtet that six
 * members report from and that must never be labelled as that lokal. If the
 * app ever changes it, change it here too — the site contradicting the app
 * about where a bird was is exactly the bug this constant prevents.
 */
export const AT_LOKAL_KM = 0.3

/**
 * How recently a larm has to have arrived for a lokal to read as active, which
 * is what the map's green dot means. The app's Lokaler screen uses the same
 * fortnight.
 */
export const ACTIVE_DAYS = 14

/** The lokal side of the comparison: a position and the id a larm can name. */
export type LokalPoint = {
  id: number
  latitude: number | null
  longitude: number | null
}

/**
 * The larm side. This is the lean row the read path fetches for the map — no
 * species, no observer, no photo, because none of that is needed to decide
 * which lokal a larm belongs to.
 */
export type LarmPoint = {
  sent_at: string
  latitude: number | null
  longitude: number | null
  location_id: number | null
}

export type LokalRelation = "at" | "near" | "elsewhere"

/**
 * The lokal a larm was sent **from**, or null when it was sent from none.
 *
 * Nearest wins, and only one lokal ever wins. The app says why in its own
 * words (`../mafk-mobie/src/lib/query/alerts.ts`): *"a pin between two lokaler
 * belongs to the closer one, never to both."* Six pairs of the club's lokaler
 * are within 200 m of each other — Tröskeln and Trösklen/Lillåns våtmarker are
 * 52 m apart — so without this, one evening at the Tröskeln would be filed as
 * "på lokalen" at three different places, each claiming it.
 *
 * The reporter's own choice outranks the coordinate: an explicit answer is
 * better evidence than a GPS fix taken from the car park.
 */
export function homeLokalId(larm: LarmPoint, lokaler: readonly LokalPoint[]): number | null {
  if (larm.location_id !== null) return larm.location_id
  if (larm.latitude === null || larm.longitude === null) return null

  let best: { id: number; km: number } | null = null
  for (const lokal of lokaler) {
    if (lokal.latitude === null || lokal.longitude === null) continue
    const km = distanceKm(lokal.latitude, lokal.longitude, larm.latitude, larm.longitude)
    if (km <= AT_LOKAL_KM && (!best || km < best.km)) best = { id: lokal.id, km }
  }
  return best?.id ?? null
}

/**
 * Where one larm sits relative to one lokal.
 *
 * "at" is exclusive — see {@link homeLokalId}. "near" is not: a larm in town
 * is near a dozen lokaler at once, which is exactly what D1's three-kilometre
 * blur means and why the lokal page keeps the two under separate headings.
 */
export function classifyForLokal(
  lokal: LokalPoint,
  larm: LarmPoint,
  lokaler: readonly LokalPoint[]
): LokalRelation {
  if (homeLokalId(larm, lokaler) === lokal.id) return "at"
  if (lokal.latitude === null || lokal.longitude === null) return "elsewhere"
  if (larm.latitude === null || larm.longitude === null) return "elsewhere"

  const km = distanceKm(lokal.latitude, lokal.longitude, larm.latitude, larm.longitude)
  return km <= NEAR_KM ? "near" : "elsewhere"
}

export type LokalActivity = {
  /** Larm **at** the lokal. Never the nearby ones — see {@link lokalActivity}. */
  alertCount: number
  /** ISO 8601 of the most recent of those, or null when there is none. */
  lastAlertAt: string | null
  active: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The tally the register prints and the dot the map draws. **"At" only.**
 *
 * Counting the nearby larm too was tried first and is wrong, which the live
 * data shows plainly: within 3 km of Broarna i Timsfors there are 109 larm and
 * 9 of them were sent from it. Those 109 are mostly the same reports, counted
 * again at every other lokal around Markaryd tätort, so a register built on
 * them would rank a dozen places identically and call each one a hotspot.
 *
 * "At" is a claim the club would actually make — 29 larm from Rallvägen, 24
 * from Reningsdammarna — and it is the same number the app's Lokaler screen
 * shows, which is the point of keeping {@link AT_LOKAL_KM} in step with it.
 * The nearby larm are still on the lokal's page, under a heading that says
 * what they are.
 */
export function lokalActivity(
  lokal: LokalPoint,
  larm: readonly LarmPoint[],
  lokaler: readonly LokalPoint[],
  now: Date = new Date()
): LokalActivity {
  const since = now.getTime() - ACTIVE_DAYS * DAY_MS
  let alertCount = 0
  let lastAlertAt: string | null = null
  let active = false

  for (const point of larm) {
    if (homeLokalId(point, lokaler) !== lokal.id) continue
    alertCount++
    if (lastAlertAt === null || point.sent_at > lastAlertAt) lastAlertAt = point.sent_at
    if (!active) {
      const sent = Date.parse(point.sent_at)
      if (Number.isFinite(sent) && sent >= since) active = true
    }
  }

  return { alertCount, lastAlertAt, active }
}

/**
 * The bounding box that certainly contains every larm within {@link NEAR_KM}
 * of a lokal, for narrowing the query server-side before the real circular
 * test runs. Generous on purpose: it over-selects, it never under-selects.
 */
export function nearBox(lokal: LokalPoint): {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
} | null {
  if (lokal.latitude === null || lokal.longitude === null) return null
  const dLat = NEAR_KM / 111.32
  // At 56°N a degree of longitude is about 62 km; the cosine guard keeps this
  // finite if a lokal ever lands near a pole.
  const dLng = NEAR_KM / (111.32 * Math.max(0.1, Math.cos((lokal.latitude * Math.PI) / 180)))
  return {
    minLat: lokal.latitude - dLat,
    maxLat: lokal.latitude + dLat,
    minLng: lokal.longitude - dLng,
    maxLng: lokal.longitude + dLng,
  }
}
