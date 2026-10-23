/**
 * The site's page tree, built from the menu signed off on 2026-09-20
 * (docs/design.md, "Menu"), and where each of WordPress's 39 pages goes.
 *
 * One constant, so the whole mapping can be read and changed in one place:
 * the page import builds the tree from it, and the redirect map takes every
 * `from` path from it. A page's path is its slugs joined, as the site resolves
 * them (src/lib/page-tree.ts).
 */

export type TreeEntry =
  | {
      kind: "page"
      slug: string
      title: string
      /** The WordPress page whose body this takes; null for an empty section. */
      wpId: number | null
      showInMenu: boolean
      /** Old WordPress paths (no trailing slash) that 301 here. */
      from: string[]
      children?: TreeEntry[]
    }
  | {
      kind: "link"
      slug: string
      title: string
      url: string
      showInMenu: boolean
      from: string[]
    }

const ARTPORTALEN = "https://www.artportalen.se"

/** Sort orders step by 10 (as /admin does), in the order listed. */
export const PAGE_TREE: TreeEntry[] = [
  {
    kind: "link",
    slug: "artiklar",
    title: "Artiklar",
    url: "/artiklar",
    showInMenu: true,
    from: [],
  },
  { kind: "link", slug: "larm", title: "Larm", url: "/larm", showInMenu: true, from: [] },
  {
    kind: "link",
    slug: "program",
    title: "Program",
    url: "/kalender",
    showInMenu: true,
    // The hand-edited Årsprogram is replaced by /kalender (F3).
    from: ["/program", "/program/program-2013"],
  },
  {
    kind: "page",
    slug: "obsar",
    title: "Obsar",
    wpId: 908,
    showInMenu: true,
    // Today's "Obsar" (/svalan/) and "Listor" (/listor/) become one section.
    from: ["/svalan", "/listor"],
    children: [
      {
        kind: "link",
        slug: "rapportera",
        title: "Rapportera på Artportalen",
        url: `${ARTPORTALEN}/`,
        showInMenu: true,
        from: ["/svalan/rapportera-pa-svalan"],
      },
      {
        kind: "link",
        slug: "kommunobservationer",
        title: "Kommunobservationer",
        url: `${ARTPORTALEN}/search/sightings/area/77`,
        showInMenu: true,
        from: ["/svalan/kommunobsar"],
      },
      // "Årslista {year}": the year is fixed by hand each New Year (design.md).
      {
        kind: "link",
        slug: "arslista",
        title: "Årslista 2026",
        url: `${ARTPORTALEN}/List/Top/Species/F%C3%A5glar/2026/Kommun/Markaryd/AnySite/OrderByDate/Desc`,
        showInMenu: true,
        from: ["/listor/arslista-2015"],
      },
      {
        kind: "link",
        slug: "markarydslistan",
        title: "Markarydslistan",
        url: `${ARTPORTALEN}/List/Top/Species/F%C3%A5glar/Total/Kommun/Markaryd/AnySite/OrderByDate/Desc`,
        showInMenu: true,
        from: ["/listor/markarydslistan-2"],
      },
      {
        kind: "link",
        slug: "observatorsligan",
        title: "Observatörsligan 2026",
        url: `${ARTPORTALEN}/List/Top/User/F%C3%A5glar/2026/Kommun/Markaryd`,
        showInMenu: true,
        from: ["/listor/observatorsligan-2015"],
      },
      {
        kind: "link",
        slug: "blekinge",
        title: "Blekinge",
        url: `${ARTPORTALEN}/search/sightings/area/1`,
        showInMenu: true,
        from: ["/svalan/blekinge"],
      },
      {
        kind: "link",
        slug: "halland",
        title: "Halland",
        url: `${ARTPORTALEN}/search/sightings/area/5`,
        showInMenu: true,
        from: ["/svalan/halland"],
      },
      {
        kind: "link",
        slug: "skane",
        title: "Skåne",
        url: `${ARTPORTALEN}/search/sightings/area/11`,
        showInMenu: true,
        from: ["/svalan/skane"],
      },
      {
        kind: "link",
        slug: "smaland",
        title: "Småland",
        url: `${ARTPORTALEN}/search/sightings/area/8060`,
        showInMenu: true,
        from: ["/svalan/smaland"],
      },
      {
        kind: "link",
        slug: "oland",
        title: "Öland",
        url: `${ARTPORTALEN}/search/sightings/area/8061`,
        showInMenu: true,
        from: ["/svalan/oland"],
      },
    ],
  },
  {
    kind: "link",
    slug: "lokaler",
    title: "Lokaler",
    url: "/lokaler",
    showInMenu: true,
    from: ["/fagellokaler"],
  },
  {
    kind: "page",
    slug: "om-foreningen",
    title: "Klubben",
    wpId: 878,
    showInMenu: true,
    from: [],
    children: [
      {
        kind: "page",
        slug: "verksamhet",
        title: "Verksamhet",
        wpId: 891,
        showInMenu: true,
        from: [],
      },
      {
        kind: "page",
        slug: "klubbbladet",
        title: "Cinclus",
        wpId: 895,
        showInMenu: true,
        from: [],
      },
      {
        kind: "page",
        slug: "medlemskap",
        title: "Medlemskap",
        wpId: 893,
        showInMenu: true,
        from: ["/medlemsskap"],
      },
      {
        kind: "page",
        slug: "kontaktpersoner",
        title: "Kontaktpersoner",
        wpId: 897,
        showInMenu: true,
        from: ["/kontakta-oss-2"],
      },
      {
        kind: "page",
        slug: "tavlingar",
        title: "Tävlingar",
        wpId: 881,
        showInMenu: true,
        from: ["/klubbtavlingar"],
        children: [
          {
            kind: "page",
            slug: "vinterfagelrally",
            title: "Vinterfågelrally",
            wpId: 2685,
            showInMenu: true,
            from: ["/klubbtavlingar/vinterfagelrally"],
          },
          {
            kind: "page",
            slug: "smalandsrallyt",
            title: "Smålandsrallyt",
            wpId: 885,
            showInMenu: true,
            from: ["/klubbtavlingar/smalandsrallyt"],
          },
        ],
      },
      {
        kind: "page",
        slug: "fagelholkar",
        title: "Fågelholkar",
        wpId: 3359,
        showInMenu: true,
        from: ["/forsaljning", "/forsaljning/fagelholkar"],
      },
      {
        kind: "page",
        slug: "lankar",
        title: "Länkar",
        wpId: 903,
        showInMenu: true,
        from: ["/lankar"],
      },
      // Not in the signed-off menu: practical notes for meetings and trips,
      // listed on the Klubben page but kept out of the menu until decided.
      {
        kind: "page",
        slug: "allmant",
        title: "Allmänt",
        wpId: 1002,
        showInMenu: false,
        from: ["/program/allmant"],
      },
    ],
  },
]

/**
 * The WordPress lokal pages, which 301 to the site's own lokal pages (F5).
 * `tanneryd-damm` matches none of the 61 lokaler and waits for a decision.
 */
export const LOKAL_MOVES: Record<string, string> = {
  "/fagellokaler/altaboke-sjo": "/lokaler/altaboke-sjo",
  "/fagellokaler/hammarsjon": "/lokaler/hammarsjon",
  "/fagellokaler/kophultssjon": "/lokaler/kophultasjon",
  "/fagellokaler/lokasjoomradet": "/lokaler/lokasjoomradet",
  "/fagellokaler/ribersdal": "/lokaler/reningsdammarna",
  "/fagellokaler/skaraps-angar": "/lokaler/skararps-angar",
  "/fagellokaler/tannsjo": "/lokaler/tannsjoomradet",
  "/fagellokaler/angaback-och-skogon": "/lokaler/angaback",
}

/**
 * The app links to the legal pages at the root; WordPress serves them under
 * /om-foreningen/. The site keeps the canonical form as static pages (D6).
 */
export const LEGAL_PAGES = [
  "integritetspolicy-markaryds-fagelklubb-appen",
  "anvandarvillkor-markaryds-fagelklubb-appen",
] as const

/** WordPress pages deliberately not imported, and why. */
export const NOT_IMPORTED: Record<number, string> = {
  10124: "legal page, a static .astro page instead (D6)",
  10126: "legal page, a static .astro page instead (D6)",
  2676: "Årsprogram, replaced by /kalender (F3)",
  899: "empty Program section, replaced by /kalender",
  889: "empty Listor section, merged into Obsar",
  905: "Lokalrapporter, replaced by /lokaler (F5)",
  2888: "empty Försäljning section, its one child moves under Klubben",
  1454: "a link to the Smålandsrallyt 2015 Excel file: waits for document storage",
  1969: "Tånnerydsdammen matches no lokal: waits for a decision",
}

/** Every entry with its full path, depth first, in order. */
export function flattenTree(
  entries: readonly TreeEntry[] = PAGE_TREE,
  parentPath = ""
): { entry: TreeEntry; path: string; parentPath: string | null; sortOrder: number }[] {
  return entries.flatMap((entry, index) => {
    const path = `${parentPath}/${entry.slug}`
    const self = { entry, path, parentPath: parentPath || null, sortOrder: (index + 1) * 10 }
    return entry.kind === "page" && entry.children
      ? [self, ...flattenTree(entry.children, path)]
      : [self]
  })
}
