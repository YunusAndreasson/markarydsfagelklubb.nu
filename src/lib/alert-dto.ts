import type { RarityLevel } from "./rarity"
import { rarityLevel } from "./rarity"

/**
 * The public shape of one larm — the only thing the larm read path may hand a
 * page (docs/roadmap.md, D1).
 *
 * This file is the boundary between a secret key that can read everything and
 * a web page anyone can open, so it is written to be hard to widen by
 * accident:
 *
 * - The DTO is camelCase while the rows are snake_case, so `{ ...row }` can't
 *   satisfy the type and the mapper has to name each field it publishes.
 * - {@link ALERT_SELECT} is the only column list the feed ever asks for, and
 *   `alert-dto.test.ts` pins it character for character. Widening it fails a
 *   test first, where someone has to decide whether the new column may be
 *   published.
 * - The same test maps a row whose forbidden values carry sentinels and
 *   asserts none of them survives `JSON.stringify`, which catches nesting and
 *   spreads that a list of keys would miss.
 *
 * Never published: `phone`, `observations.comment`, `image_path`, any user id,
 * `recipient_count`, `avatar_path`, and the exact latitude/longitude.
 */

export type PublicAlert = {
  /** `alerts.id`. The only identifier that reaches the public; addresses the photo. */
  id: string
  species: string
  scientificName: string
  /** 0 (rarest) … 5 (commonest); an unlisted species is 5. */
  rarity: RarityLevel
  count: number | null
  /** ISO 8601 — when the bird was seen. */
  observedAt: string
  /** ISO 8601 — when the larm went out. The feed's sort key. */
  sentAt: string
  /** A coarse label from `alert-place.ts`. Never a coordinate. */
  place: string
  /** The live display name, or null when the page should say "En medlem". */
  observer: string | null
  /** `/larm/bild/<id>`, or null when the report carried no photo. */
  photoUrl: string | null
}

export const PUBLIC_ALERT_FIELDS = [
  "count",
  "id",
  "observedAt",
  "observer",
  "photoUrl",
  "place",
  "rarity",
  "scientificName",
  "sentAt",
  "species",
] as const satisfies readonly (keyof PublicAlert)[]

/**
 * Exactly what PostgREST is asked for.
 *
 * `latitude`, `longitude`, `location_id` and `image_path` are read — the place
 * ladder, the lokal pages and the photo route need them — and never published.
 * `observer_name` is **not** read at all: it is a snapshot that outlives a
 * deleted account, and the name comes from `profiles` instead (see
 * `alert-observer.ts`).
 *
 * `location_id` was added in step 6 (F5) as the honest join key for
 * "which lokal is this larm's?" — the reporter's own answer, which beats a
 * coordinate. It identifies a place, not a person, and `lokal-alerts.ts` turns
 * it into a heading rather than a published field.
 */
export const ALERT_SELECT =
  "id, count, observed_at, sent_at, observer_user_id, latitude, longitude, location_id, location_name, species_id, species:species(swedish_name, scientific_name, rarity), observation:observations(image_path)"

/** The two columns the observer lookup may touch on `profiles`. */
export const PROFILE_SELECT = "user_id, display_name"

/**
 * Columns the secret key could read and this path must never ask for. Asserted
 * absent from the selects above.
 */
export const FORBIDDEN_COLUMNS = [
  "activity",
  "avatar_path",
  "comment",
  "is_admin",
  "observer_name",
  "phone",
  "recipient_count",
  "user_id",
] as const

export type AlertRow = {
  id: string
  count: number | null
  observed_at: string | null
  sent_at: string
  observer_user_id: string | null
  latitude: number | null
  longitude: number | null
  location_id: number | null
  location_name: string | null
  species_id: number | null
  species: { swedish_name: string; scientific_name: string; rarity: number | null } | null
  observation: { image_path: string | null } | null
}

/** Where a larm's photo is served from. Never the storage path. */
export function alertPhotoUrl(id: string): string {
  return `/larm/bild/${id}`
}

/**
 * The only constructor of a `PublicAlert`.
 *
 * `place` and `observer` are decided by `alert-place.ts` and
 * `alert-observer.ts` and passed in, so this function has nothing to improvise
 * with — it cannot reach for `latitude` or `observer_name` even if a future
 * edit wanted to.
 */
export function toPublicAlert(row: AlertRow, place: string, observer: string | null): PublicAlert {
  return {
    id: row.id,
    species: row.species?.swedish_name ?? "Obestämd art",
    scientificName: row.species?.scientific_name ?? "",
    rarity: rarityLevel(row.species?.rarity),
    count: row.count,
    // Never null in the live data, and `sent_at` is the honest stand-in if it
    // ever is: the larm certainly existed then.
    observedAt: row.observed_at ?? row.sent_at,
    sentAt: row.sent_at,
    place,
    observer,
    photoUrl: row.observation?.image_path ? alertPhotoUrl(row.id) : null,
  }
}
