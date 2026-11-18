/**
 * WordPress's 46 categories onto the site's categories (docs/roadmap.md, F2,
 * signed off 2026-09-20). Keyed on the WordPress category slug, read from
 * `/wp-json/wp/v2/categories` the same day and again on 2026-10-23.
 *
 * "Okategoriserade" is deliberately absent: those posts get no category.
 *
 * Since 2026-11-18 there are five: "Program" is gone from the articles, so the
 * word means one thing on the site, the programme at /kalender. Its posts are
 * the club's old excursion announcements and went to Exkursioner, and
 * "Tävlingar" is called "Utmaningar" (its slug, and so its URL, is unchanged).
 */

export type SiteCategory = {
  slug: string
  name: string
}

/** Most specific first: when a post has several, the earliest here wins. */
export const SITE_CATEGORIES: readonly SiteCategory[] = [
  { slug: "tavlingar", name: "Utmaningar" },
  { slug: "motesplats-ekebacken", name: "Mötesplats Ekebacken" },
  { slug: "exkursioner", name: "Exkursioner" },
  { slug: "referat", name: "Referat" },
  { slug: "foreningsaktuellt", name: "Föreningsaktuellt" },
]

/** WordPress category slug → site category slug. */
export const CATEGORY_MAP: Readonly<Record<string, string>> = {
  // Föreningsaktuellt
  foreningsaktuellt: "foreningsaktuellt",
  arsmote: "foreningsaktuellt",
  styrelsen: "foreningsaktuellt",
  medlemsmoten: "foreningsaktuellt",
  medlemsmote: "foreningsaktuellt",
  medlemstraff: "foreningsaktuellt",
  redaktion: "foreningsaktuellt",
  medlemsskap: "foreningsaktuellt",
  upprop: "foreningsaktuellt",
  forsaljning: "foreningsaktuellt",
  foreningstips: "foreningsaktuellt",
  konstutstallning: "foreningsaktuellt", // an art-exhibition tip, added 2026-11
  fagelholkar: "foreningsaktuellt",
  larmapp: "foreningsaktuellt",
  svalan: "foreningsaktuellt",
  veteranerna: "foreningsaktuellt",
  fagellarm: "foreningsaktuellt",
  "44": "foreningsaktuellt", // "+"
  // Referat
  referat: "referat",
  "fran-faltet": "referat",
  uppsnappat: "referat",
  "uppsnappat-pa-faltet": "referat",
  strackrakning: "referat",
  hostflyttning: "referat",
  inventering: "referat",
  skadartips: "referat",
  fenelogi: "referat",
  orngruppen: "referat",
  // Utmaningar (slug tavlingar)
  smalandsrallyt: "tavlingar",
  vinterfagelrally: "tavlingar",
  "vinterfaglar-inpa-knuten": "tavlingar",
  allhelgonarallyt: "tavlingar",
  lokalkampen: "tavlingar",
  // Exkursioner
  exkursioner: "exkursioner",
  uggletider: "exkursioner",
  forelasning: "exkursioner",
  "fagelskadningens-dag": "exkursioner",
  ejderskadning: "exkursioner",
  nattfaglar: "exkursioner",
  fotoutstallning: "exkursioner",
  arrengemang: "exkursioner",
  "motesplats-lokasjon": "exkursioner",
  // Mötesplats Ekebacken
  "motesplats-ekebacken": "motesplats-ekebacken",
  // Program: the programme is /kalender, its old announcements are excursions.
  program: "exkursioner",
  "program-2025": "exkursioner",
  "program-2026": "exkursioner",
}

/**
 * Posts whose site category no mapping gives, keyed by WordPress post id, so a
 * re-import keeps the choice. 5480, the spring's Mötesplats Ekebacken invitation,
 * was filed only under Program 2026.
 */
export const CATEGORY_FIXES: Readonly<Record<number, string>> = {
  5480: "motesplats-ekebacken",
}

export type CategoryPick =
  | { kind: "category"; slug: string }
  | { kind: "none" }
  | { kind: "unmapped"; wpSlugs: string[] }

/**
 * The one site category for a post's WordPress categories. An unknown
 * WordPress slug is reported, never guessed: a category added since the
 * sign-off needs a human decision.
 */
export function pickCategory(wpSlugs: readonly string[]): CategoryPick {
  const unmapped = wpSlugs.filter((slug) => slug !== "okategoriserade" && !(slug in CATEGORY_MAP))
  if (unmapped.length > 0) return { kind: "unmapped", wpSlugs: unmapped }
  const mapped = new Set(wpSlugs.map((slug) => CATEGORY_MAP[slug]).filter(Boolean))
  const winner = SITE_CATEGORIES.find((category) => mapped.has(category.slug))
  return winner ? { kind: "category", slug: winner.slug } : { kind: "none" }
}

/** A post's site category: its fix if it has one, otherwise what its WordPress categories give. */
export function categoryFor(wpId: number, wpSlugs: readonly string[]): CategoryPick {
  const fixed = CATEGORY_FIXES[wpId]
  return fixed ? { kind: "category", slug: fixed } : pickCategory(wpSlugs)
}
