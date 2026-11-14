import boundary from "../data/markaryd-boundary.json"

/**
 * Where a larm is published as having happened (docs/roadmap.md, D1, revised
 * 2026-11-14).
 *
 * Two answers, for two uses:
 *
 *   • a **label**, the text the feed, the lists and the admin print —
 *     "Hualtet", "Nära Hualtet", "Markaryds kommun";
 *   • the **position** the larm's own map draws, published exactly since
 *     2026-11-14, and the lokal the label names, so the label can link to it.
 *
 * The app stores a free coordinate for all but 21 of the 238 larm, and many of
 * those coordinates repeat exactly — a member reporting from their own garden
 * day after day. That is why a protected species (rung 1) gets **no position
 * and no lokal at all**, only the kommun, and why `alert-place.test.ts` asserts
 * that {@link coarsePlace}'s label never carries a coordinate on any rung.
 *
 * The label's ladder, in order:
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
  location_id?: number | null
  location_name: string | null
  latitude: number | null
  longitude: number | null
  species_id: number | null
}

export type NamedLocation = {
  id?: number
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

export type NearestLocation<L extends NamedLocation = NamedLocation> = {
  name: string
  km: number
  location: L
}

/** The closest named lokal, or null when none of them has a coordinate. */
export function nearestLocation<L extends NamedLocation>(
  latitude: number,
  longitude: number,
  locations: readonly L[]
): NearestLocation<L> | null {
  let best: NearestLocation<L> | null = null
  for (const location of locations) {
    if (location.latitude === null || location.longitude === null) continue
    const km = distanceKm(latitude, longitude, location.latitude, location.longitude)
    if (!best || km < best.km) best = { name: location.name, km, location }
  }
  return best
}

/**
 * How finely a published position is written: five decimals, about a metre.
 * Not a blur — the app's pins are already exact — only the GPS noise digits
 * a page has no use for.
 */
const POSITION_DECIMALS = 5
const roundCoordinate = (value: number) => Number(value.toFixed(POSITION_DECIMALS))

export type PublicPosition = { latitude: number; longitude: number }

export type PublicPlace<L extends NamedLocation = NamedLocation> = {
  /** The label the lists print. Never a coordinate. */
  label: string
  /** The lokal the label names (rungs 2 and 3), or null. */
  lokal: L | null
  /** Where the larm was reported from, or null for a protected species or no pin. */
  position: PublicPosition | null
}

const sameName = (a: string, b: string) => a.localeCompare(b, "sv", { sensitivity: "accent" }) === 0

/**
 * Everything a page may say about where one larm happened: the label, the
 * lokal it names and the exact position.
 *
 * A protected species gets the kommun label and nothing else — no lokal, which
 * would pinpoint the bird by name, and no position.
 */
export function publicPlace<L extends NamedLocation>(
  alert: AlertPoint,
  locations: readonly L[]
): PublicPlace<L> {
  const { latitude, longitude } = alert
  const hasPoint =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)

  // Rung 1. Ahead of the lokal name, which would otherwise pinpoint the bird.
  if (alert.species_id !== null && PLACE_SUPPRESSED_SPECIES.has(alert.species_id)) {
    const label = hasPoint && !isInsideKommun(latitude, longitude) ? OUTSIDE_PLACE : KOMMUN_PLACE
    return { label, lokal: null, position: null }
  }

  const position = hasPoint
    ? { latitude: roundCoordinate(latitude), longitude: roundCoordinate(longitude) }
    : null

  // Rung 2. The reporter chose a lokal; it is already a public place name. The
  // id is the honest join; the name is the fallback for a lokal renamed since.
  const named = alert.location_name?.trim()
  if (named) {
    const lokal =
      locations.find(
        (location) => location.id !== undefined && location.id === alert.location_id
      ) ??
      locations.find((location) => sameName(location.name, named)) ??
      null
    return { label: named, lokal, position }
  }

  if (!hasPoint) return { label: UNKNOWN_PLACE, lokal: null, position: null }

  // Rung 3. Close enough that the lokal is a fair description of where to look.
  const nearest = nearestLocation(latitude, longitude, locations)
  if (nearest && nearest.km <= NEAR_KM) {
    return { label: `Nära ${nearest.name}`, lokal: nearest.location, position }
  }

  // Rungs 4 and 5.
  return {
    label: isInsideKommun(latitude, longitude) ? KOMMUN_PLACE : OUTSIDE_PLACE,
    lokal: null,
    position,
  }
}

/** The public place label for one larm. Never a coordinate. */
export function coarsePlace(alert: AlertPoint, locations: readonly NamedLocation[]): string {
  return publicPlace(alert, locations).label
}
