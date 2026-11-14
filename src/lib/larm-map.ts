import type { PublicAlert } from "./alert-dto"
import type { PublicPosition } from "./alert-place"
import { isRare } from "./rarity"

/**
 * What a larm map island is handed (docs/design.md, "Larm på kartan").
 *
 * Built on the server from {@link PublicAlert}s that `alert-place.ts` has
 * already decided on, so an island never sees a raw row and never imports the
 * larm read path — `secret-key-scope.test.ts` fails any `.tsx` that does. The
 * shape is the island's whole contract: a point, and per larm an id, a species
 * and whether it is rare. No observer, no photo.
 */

export type LarmPinAlert = { id: string; species: string; rare: boolean }

export type LarmPin = PublicPosition & {
  /** Newest first. Several when larm were sent from the very same point. */
  alerts: LarmPinAlert[]
  /** Any of them "Ovanlig" or rarer: the pin takes the rarity colour. */
  rare: boolean
}

const key = ({ latitude, longitude }: PublicPosition) => `${latitude},${longitude}`

/**
 * One pin per point. Larm on the very same point share one — a member
 * reporting from their garden all morning is one place, not a stack of dots
 * hiding each other. Larm without a position (a protected species, or none
 * given) are left out. Rare pins come last, so Leaflet draws them on top.
 */
export function toLarmPins(
  alerts: readonly Pick<PublicAlert, "id" | "species" | "rarity" | "observedAt" | "position">[]
): LarmPin[] {
  const pins = new Map<string, LarmPin>()
  const newestFirst = alerts.toSorted((a, b) => (a.observedAt < b.observedAt ? 1 : -1))
  for (const alert of newestFirst) {
    if (!alert.position) continue
    const rare = isRare(alert.rarity)
    const entry = { id: alert.id, species: alert.species, rare }
    const existing = pins.get(key(alert.position))
    if (existing) {
      existing.alerts.push(entry)
      existing.rare ||= rare
    } else {
      pins.set(key(alert.position), { ...alert.position, alerts: [entry], rare })
    }
  }
  return [...pins.values()].sort((a, b) => Number(a.rare) - Number(b.rare))
}

/** How close the "Öppna i OpenStreetMap" link opens: field paths and buildings. */
const OSM_ZOOM = 16

/**
 * The exact place on openstreetmap.org, with a marker: the way to get there
 * from a phone in the field, and the map's no-JavaScript equivalent.
 */
export function osmLink({ latitude, longitude }: PublicPosition): string {
  const params = new URLSearchParams({ mlat: String(latitude), mlon: String(longitude) })
  return `https://www.openstreetmap.org/?${params}#map=${OSM_ZOOM}/${latitude}/${longitude}`
}
