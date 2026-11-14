import { type RarityLevel, rarityLevel } from "./rarity"
import { RESERVED_TOP_LEVEL_SLUGS, slugify } from "./slug"

/**
 * The species the site has a page for (docs/design.md, "Arter"), joined from
 * two sources that share no key:
 *
 *   • **Artportalen** taxa, every bird ever reported in the kommun, by taxon
 *     id, with lower-case Swedish names ("kungsfiskare") and the newest
 *     taxonomy ("Astur gentilis");
 *   • the **app's** `public.species`, the club's own list with its rarity
 *     prefix and the larm, by its own id, capitalised ("Kungsfiskare"),
 *     sometimes on older taxonomy ("Accipiter gentilis").
 *
 * So they are matched on the scientific name first and the Swedish name
 * second. A species gets a page when Artportalen has seen it in the kommun or
 * a member has larmed it; the app's list of ~300 names alone doesn't make one.
 */

export type TaxonName = { id: number; name: string; sci: string }

export type AppSpecies = {
  id: number
  name: string
  sci: string
  rarity: number | null
  /** Larm the public can see (hidden ones aren't counted). */
  alertCount: number
  lastAlertAt: string | null
}

export type SpeciesRef = {
  slug: string
  /** Capitalised, as a heading writes it. */
  name: string
  sci: string
  taxonId: number | null
  appId: number | null
  /**
   * The club's prefix, or null for a bird only Artportalen knows: it isn't on
   * the club's list, and calling it "Allmän" could be badly wrong.
   */
  rarity: RarityLevel | null
  alertCount: number
  lastAlertAt: string | null
  /**
   * The slug Artportalen's own spelling gives, when the app names the bird
   * differently: links built from Artportalen alone (the home page's season
   * block) use it, and the page answers it with a 301 to {@link slug}.
   */
  altSlug: string | null
}

const normal = (text: string) => text.trim().toLocaleLowerCase("sv").replace(/\s+/g, " ")
const capitalise = (text: string) => text.charAt(0).toLocaleUpperCase("sv") + text.slice(1)

/**
 * Every species with a page, in Swedish alphabetical order.
 *
 * The slug comes from the Swedish name. Slugs are decided in a fixed order —
 * Artportalen's taxa by id, then the app-only species by id — so the same
 * data always gives the same URLs, and a collision (none today) gets the id
 * appended rather than moving an existing page.
 */
export function buildSpecies(taxa: readonly TaxonName[], app: readonly AppSpecies[]): SpeciesRef[] {
  const bySci = new Map(app.map((one) => [normal(one.sci), one]))
  const byName = new Map(app.map((one) => [normal(one.name), one]))
  const matched = new Set<number>()

  const out: Omit<SpeciesRef, "slug" | "altSlug">[] = []
  const artportalenName = new Map<number, string>()
  for (const taxon of taxa.toSorted((a, b) => a.id - b.id)) {
    const own = bySci.get(normal(taxon.sci)) ?? byName.get(normal(taxon.name))
    if (own && matched.has(own.id)) continue
    if (own) matched.add(own.id)
    artportalenName.set(taxon.id, taxon.name)
    out.push({
      name: own ? own.name : capitalise(taxon.name),
      sci: taxon.sci,
      taxonId: taxon.id,
      appId: own?.id ?? null,
      rarity: own ? rarityLevel(own.rarity) : null,
      alertCount: own?.alertCount ?? 0,
      lastAlertAt: own?.lastAlertAt ?? null,
    })
  }
  for (const own of app.toSorted((a, b) => a.id - b.id)) {
    // "Övrigt (ej fågel)", the app's catch-all, is the one row with no
    // scientific name: not a bird, so no page.
    if (matched.has(own.id) || own.alertCount === 0 || own.sci.trim() === "") continue
    out.push({
      name: own.name,
      sci: own.sci,
      taxonId: null,
      appId: own.id,
      rarity: rarityLevel(own.rarity),
      alertCount: own.alertCount,
      lastAlertAt: own.lastAlertAt,
    })
  }

  const taken = new Set<string>()
  const withSlugs = out.map((one) => {
    const base = slugify(one.name)
    const id = one.taxonId ?? one.appId
    let slug = base !== "" && !RESERVED_TOP_LEVEL_SLUGS.has(base) ? base : `art-${id}`
    if (taken.has(slug)) slug = `${slug}-${id}`
    taken.add(slug)
    const own = one.taxonId === null ? null : slugify(artportalenName.get(one.taxonId) ?? "")
    return { ...one, slug, altSlug: own && own !== slug && own !== base ? own : null }
  })
  return withSlugs.sort((a, b) => a.name.localeCompare(b.name, "sv"))
}

export function findSpecies(slug: string, species: readonly SpeciesRef[]): SpeciesRef | null {
  return species.find((one) => one.slug === slug) ?? null
}

/** A species whose Artportalen spelling gives this slug, to redirect to its page. */
export function findBySpelling(slug: string, species: readonly SpeciesRef[]): SpeciesRef | null {
  return species.find((one) => one.altSlug === slug) ?? null
}

/** The species page for an app species id — a larm's link to its bird. */
export function speciesForApp(appId: number, species: readonly SpeciesRef[]): SpeciesRef | null {
  return species.find((one) => one.appId === appId) ?? null
}

/** The species page for a Swedish name, as Artportalen or the app writes it. */
export function speciesNamed(name: string, species: readonly SpeciesRef[]): SpeciesRef | null {
  const wanted = normal(name)
  return species.find((one) => normal(one.name) === wanted) ?? null
}

/**
 * Taxon id → slug, for linking many Artportalen rows at once (Årslistan's 150).
 * By id, not name: the two sources don't always spell a bird the same way.
 */
export function taxonSlugs(species: readonly SpeciesRef[]): Map<number, string> {
  const map = new Map<number, string>()
  for (const one of species) if (one.taxonId !== null) map.set(one.taxonId, one.slug)
  return map
}

export const speciesHref = (slug: string) => `/arter/${slug}`

/**
 * A link to a bird's page from its Swedish name alone, as Artportalen or the
 * app writes it, for pages that don't load the species list (the Obsar
 * registers, a larm). The page's slug is the slugified name; Artportalen's
 * spelling of a bird the app names differently is answered with a 301
 * (`altSlug`). Only a slug collision, none today, would miss.
 */
export const speciesLink = (name: string) => speciesHref(slugify(name))
