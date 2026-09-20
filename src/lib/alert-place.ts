import boundary from "../data/markaryd-boundary.json"

/**
 * Where a larm is published as having happened (docs/roadmap.md, D1).
 *
 * The app stores a free coordinate for all but 21 of the 238 larm, and many of
 * those coordinates repeat exactly — a member reporting from their own garden
 * day after day. So this is not a formatting helper: it is the rule that keeps
 * an exact position off the public web. **Nothing here ever returns a
 * coordinate**, and `alert-place.test.ts` asserts that for every rung.
 *
 * The ladder, in order:
 *
 *   1. a protected species          → never better than the kommun
 *   2. the larm names a lokal       → that name
 *   3. a lokal within NEAR_KM       → "Nära <lokal>"
 *   4. inside the kommun            → "Markaryds kommun"
 *   5. otherwise                    → "Utanför kommunen"
 *
 * Measured against the live data on 2026-09-20, NEAR_KM = 3 puts 190 of 238
 * larm on rung 3, 21 on rung 2, 19 on rung 5 (Malmö, Dublin, Åhus) and only 7
 * on the vague rung 4. One larm has no coordinate at all.
 */

export const NEAR_KM = 3

export type AlertPoint = {
  location_name: string | null
  latitude: number | null
  longitude: number | null
  species_id: number | null
}

export type NamedLocation = {
  name: string
  latitude: number | null
  longitude: number | null
}

export const KOMMUN_PLACE = "Markaryds kommun"
export const OUTSIDE_PLACE = "Utanför kommunen"
export const UNKNOWN_PLACE = "Okänd plats"

/**
 * Species whose place is never published more precisely than the kommun.
 *
 * Empty today, and wired up anyway. The app has no sensitivity flag —
 * `species.rarity` measures how often a bird is seen, not whether publishing
 * its nest would put it at risk — so this list has to be maintained by hand,
 * following Artportalen's skyddsklassade arter. Having the hook in place means
 * the first Berguv is a one-line change instead of an emergency.
 */
export const PLACE_SUPPRESSED_SPECIES: ReadonlySet<number> = new Set<number>()

const EARTH_RADIUS_KM = 6371
const toRadians = (degrees: number) => (degrees * Math.PI) / 180

/** Great-circle distance in kilometres. */
export function distanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const dLat = toRadians(toLat - fromLat)
  const dLng = toRadians(toLng - fromLng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

const [WEST, SOUTH, EAST, NORTH] = boundary.bbox as [number, number, number, number]
const RINGS = boundary.rings as [number, number][][]

/** Ray casting against one ring, in lon/lat degrees. */
function insideRing(
  lng: number,
  lat: number,
  ring: readonly (readonly [number, number])[]
): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number]
    const [xj, yj] = ring[j] as [number, number]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Is the point in Markaryds kommun?
 *
 * The polygon is OSM relation 935621, simplified to about 30 m, plus the
 * kommun's three sub-kilometre exclaves, which a coarser simplification would
 * have erased. The bounding box rejects the far-away points (Malmö, Dublin)
 * without walking 379 vertices.
 */
export function isInsideKommun(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
  if (longitude < WEST || longitude > EAST || latitude < SOUTH || latitude > NORTH) return false
  return RINGS.some((ring) => insideRing(longitude, latitude, ring))
}

export type NearestLocation = { name: string; km: number }

/** The closest named lokal, or null when none of them has a coordinate. */
export function nearestLocation(
  latitude: number,
  longitude: number,
  locations: readonly NamedLocation[]
): NearestLocation | null {
  let best: NearestLocation | null = null
  for (const location of locations) {
    if (location.latitude === null || location.longitude === null) continue
    const km = distanceKm(latitude, longitude, location.latitude, location.longitude)
    if (!best || km < best.km) best = { name: location.name, km }
  }
  return best
}

/** The public place label for one larm. Never a coordinate. */
export function coarsePlace(alert: AlertPoint, locations: readonly NamedLocation[]): string {
  const { latitude, longitude } = alert
  const hasPoint = latitude !== null && longitude !== null

  // Rung 1. Ahead of the lokal name, which would otherwise pinpoint the bird.
  if (alert.species_id !== null && PLACE_SUPPRESSED_SPECIES.has(alert.species_id)) {
    if (!hasPoint) return KOMMUN_PLACE
    return isInsideKommun(latitude, longitude) ? KOMMUN_PLACE : OUTSIDE_PLACE
  }

  // Rung 2. The reporter chose a lokal; it is already a public place name.
  const named = alert.location_name?.trim()
  if (named) return named

  if (!hasPoint) return UNKNOWN_PLACE

  // Rung 3. Close enough that the lokal is a fair description of where to look.
  const nearest = nearestLocation(latitude, longitude, locations)
  if (nearest && nearest.km <= NEAR_KM) return `Nära ${nearest.name}`

  // Rungs 4 and 5.
  return isInsideKommun(latitude, longitude) ? KOMMUN_PLACE : OUTSIDE_PLACE
}
