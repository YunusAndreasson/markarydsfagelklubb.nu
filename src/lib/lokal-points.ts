/**
 * The places within a lokal (docs/design.md, "Platser på lokalen"): what the club
 * kept on Google My Maps, now the site's own data. Pure, so an island can import
 * it and the order is tested.
 */

export type LokalPointRow = {
  id: number
  location_id: number
  linked_location_id: number | null
  kind: string
  name: string
  note: string
  latitude: number | null
  longitude: number | null
  sort_order: number
}

/** A place as a page shows it. `number` matches its pin; a place with no position has none. */
export type LokalPoint = LokalPointRow & { number: number | null }

export type MapPoint = {
  number: number
  name: string
  latitude: number
  longitude: number
  /** Its own lokal page, or its row in the list below the map. */
  href: string
}

const bySortOrder = (a: LokalPointRow, b: LokalPointRow) =>
  a.sort_order - b.sort_order || a.name.localeCompare(b.name, "sv")

/**
 * A lokal's places in reading order: what you need to get there first, then the
 * places. Numbers run through both in that order, so the list reads 1, 2, 3 down the
 * page and the map's pins can be found in it.
 */
export function orderPoints(rows: readonly LokalPointRow[]): LokalPoint[] {
  const practical = rows.filter((row) => row.kind === "practical").toSorted(bySortOrder)
  const places = rows.filter((row) => row.kind !== "practical").toSorted(bySortOrder)
  let next = 1
  return [...practical, ...places].map((row) => ({
    ...row,
    number: row.latitude !== null && row.longitude !== null ? next++ : null,
  }))
}

/**
 * Splits what the page read: the places listed on this lokal, and the row saying
 * this lokal is itself a place on another's, which gives it a breadcrumb and a note.
 */
export function splitForLokal(rows: readonly LokalPointRow[], lokalId: number) {
  return {
    own: orderPoints(rows.filter((row) => row.location_id === lokalId)),
    partOf: rows.find((row) => row.linked_location_id === lokalId) ?? null,
  }
}

const distanceKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const toRad = Math.PI / 180
  const x = (bLng - aLng) * toRad * Math.cos(((aLat + bLat) / 2) * toRad)
  const y = (bLat - aLat) * toRad
  return Math.sqrt(x * x + y * y) * 6371
}

/** From this many places on, the furthest ones stop setting the zoom. */
const MANY_POINTS = 8
const SHARE_FRAMED = 0.7

/**
 * The points the map frames; the rest stay on the map, a zoom away. Reningsdammarna
 * has a dozen places within 400 m and others up to 3 km off, and framing them all
 * piled the dozen on top of each other. A few places are all framed: at Skararps
 * ängar the 900 m out to S-kurvan is the lokal.
 */
export function pointsToFrame<T extends { latitude: number; longitude: number }>(
  points: readonly T[],
  center: { latitude: number; longitude: number }
): T[] {
  if (points.length < MANY_POINTS) return [...points]
  const away = (point: T) =>
    distanceKm(center.latitude, center.longitude, point.latitude, point.longitude)
  return points
    .toSorted((a, b) => away(a) - away(b))
    .slice(0, Math.ceil(points.length * SHARE_FRAMED))
}
