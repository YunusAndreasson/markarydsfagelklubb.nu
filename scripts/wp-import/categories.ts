/**
 * WordPress's 46 categories onto the site's six (docs/roadmap.md, F2, signed
 * off 2026-09-20). Keyed on the WordPress category slug, read from
 * `/wp-json/wp/v2/categories` the same day and again on 2026-10-23.
 *
 * "Okategoriserade" is deliberately absent: those posts get no category.
 */

export type SiteCategory = {
  slug: string
  name: string
}

/** Most specific first: when a post has several, the earliest here wins. */
export const SITE_CATEGORIES: readonly SiteCategory[] = [
  { slug: "tavlingar", name: "Tävlingar" },
  { slug: "program", name: "Program" },
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
  // Tävlingar
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
  // Program
  program: "program",
  "program-2025": "program",
  "program-2026": "program",
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
