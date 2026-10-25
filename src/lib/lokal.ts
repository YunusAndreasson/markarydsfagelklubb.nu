import { RESERVED_TOP_LEVEL_SLUGS, slugify } from "./slug"

/**
 * The club's lokaler as the public site addresses them (docs/roadmap.md, F5).
 *
 * `locations` belongs to the app and has **no slug column**, and the site never
 * writes to it (docs/shared-database.md). So a URL has to be derived from the
 * name, which makes two things this module's job: deriving it the same way
 * every time, and making sure a lokal added in the app tomorrow can't take a
 * URL that is already someone else's.
 *
 * Nothing here is member data. A lokal is the club's own place name and
 * position — the one thing about a larm that D1 lets the site publish exactly.
 */

/** What `locations` gives us, and all this module ever looks at. */
export type LokalRow = {
  id: number
  name: string
  latitude: number | null
  longitude: number | null
  description: string | null
}

export type Lokal = LokalRow & { slug: string }

/** What the map island is handed. No larm, no member data, no coordinates but the lokal's own. */
export type LokalPin = {
  slug: string
  name: string
  latitude: number
  longitude: number
  /** A larm in the last {@link ACTIVE_DAYS} days — the app's own marking. */
  active: boolean
}

/** A lokal in the register, with the tally the list prints. */
export type LokalSummary = Lokal & {
  alertCount: number
  /** ISO 8601 of the most recent larm, or null when there has been none. */
  lastAlertAt: string | null
  active: boolean
}

/**
 * A lokal name as a URL segment, using the site's one slugifier so "Köphultasjö"
 * becomes `kophultasjo` the way WordPress would have written it.
 */
export function lokalSlug(name: string): string {
  return slugify(name)
}

/**
 * Every lokal with a slug, in the order given.
 *
 * Slugs are resolved in **id order**, not in the order the rows arrive, so the
 * answer doesn't depend on how PostgREST sorted them. The oldest lokal keeps
 * the bare slug and a later collision gets its id appended — that way adding a
 * lokal can never silently move an existing page's URL, which would break every
 * link to it and the step-8 redirects along with them.
 *
 * A name that slugifies to nothing ("???"), or to a segment the site itself
 * owns, falls back to `lokal-<id>`.
 */
export function buildLokaler(rows: readonly LokalRow[]): Lokal[] {
  const taken = new Set<string>()
  const slugs = new Map<number, string>()

  for (const row of rows.toSorted((a, b) => a.id - b.id)) {
    const base = lokalSlug(row.name)
    const usable = base !== "" && !RESERVED_TOP_LEVEL_SLUGS.has(base)
    let slug = usable ? base : `lokal-${row.id}`
    if (taken.has(slug)) slug = `${slug}-${row.id}`
    taken.add(slug)
    slugs.set(row.id, slug)
  }

  // The caller's order is the display order; only the slug decision needed sorting.
  return rows.map((row) => ({ ...row, slug: slugs.get(row.id) as string }))
}

export function findLokal<T extends { slug: string }>(
  slug: string,
  lokaler: readonly T[]
): T | null {
  return lokaler.find((lokal) => lokal.slug === slug) ?? null
}

/** The pin for a lokal, or null when it has no position to draw. */
export function toPin(lokal: LokalSummary): LokalPin | null {
  if (lokal.latitude === null || lokal.longitude === null) return null
  return {
    slug: lokal.slug,
    name: lokal.name,
    latitude: lokal.latitude,
    longitude: lokal.longitude,
    active: lokal.active,
  }
}

/**
 * The letter a lokal files under in the A–Ö register.
 *
 * Swedish sorts å, ä and ö as their own letters at the end of the alphabet, so
 * "Ängabäck" files under Ä and not under A — `localeCompare("sv")` already
 * knows this, and the heading has to agree with the sort or the register lies.
 */
export function registerLetter(name: string): string {
  const first = name.trim().charAt(0).toUpperCase()
  return first === "" ? "–" : first
}

/** The register order: Swedish collation on the name. */
export function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name, "sv")
}
