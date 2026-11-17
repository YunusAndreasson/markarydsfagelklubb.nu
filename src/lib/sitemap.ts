import { OBSAR_PAGES } from "./obsar"
import type { PageTree } from "./page-tree"
import { escapeXml } from "./rss"
import { stockholmYear } from "./stockholm-time"

/**
 * The sitemap (`/sitemap.xml`), so a search engine finds every public page.
 * Almost every page renders on demand from the database, so a build-time
 * sitemap would see none of them: the route reads what the pages read and
 * passes it in here.
 *
 * Pure: the route loads the rows, this lists the URLs. What goes in is what
 * an anonymous visitor can open; what stays out, and why:
 *
 * - /admin, and anything a `to anon` policy hides (drafts, scheduled rows):
 *   the rows never reach the route.
 * - Each larm's own page (`/larm/<id>`): it is a member's report, the one
 *   place the site publishes members' data. /larm and the species pages link
 *   to them; the site doesn't hand them to search engines on its own.
 * - Month pages (`/kalender/2026-10`) and paged lists (`?fore=`): views of
 *   what is listed here already, without end in both directions.
 * - /sok, /arter (a 301), /feed, /kalender.ics and the larm photos: not pages.
 *
 * `lastmod` only where a row says when it last changed (pages, articles,
 * events). A page that also shows live data — the Obsar figures, the
 * membership fee — gets none, since its row's date would understate it.
 */

export type SitemapEntry = {
  /** "/artiklar/ny-hackfagel", from the site's root. */
  path: string
  /** ISO timestamp of the last edit, when there is one. */
  lastmod: string | null
}

export type SitemapSources = {
  tree: PageTree
  /** `pages.updated_at` by id. */
  pageUpdatedAt: ReadonlyMap<number, string>
  articles: readonly {
    slug: string
    published_at: string | null
    updated_at: string
    category_id: number | null
  }[]
  categories: readonly { id: number; slug: string }[]
  events: readonly { slug: string; updated_at: string }[]
  lokalSlugs: readonly string[]
  speciesSlugs: readonly string[]
  /** Years Artportalen's history holds, for Årslistan's and Ligan's archives. */
  obsarYears: readonly number[]
  now: Date
}

/** Routes of their own, which answer whatever the page tree holds. */
const FIXED_PATHS = [
  "/",
  "/artiklar",
  "/larm",
  "/kalender",
  ...OBSAR_PAGES.map((page) => page.href),
  "/lokaler",
  "/om-foreningen/anvandarvillkor-markaryds-fagelklubb-appen",
  "/om-foreningen/integritetspolicy-markaryds-fagelklubb-appen",
  // The visitor pages, which name each other with hreflang in their heads.
  "/en",
  "/de",
]

/** Page-tree pages whose route adds live data to the body (see above). */
const COMPOSED_PATHS: ReadonlySet<string> = new Set([
  "/obsar",
  "/om-foreningen",
  "/om-foreningen/medlemskap",
])

/** W3C datetime, which a raw Postgres timestamp (`+00:00`, microseconds) isn't always read as. */
function w3cDate(value: string): string | null {
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

export function sitemapEntries(sources: SitemapSources): SitemapEntry[] {
  const entries = new Map<string, SitemapEntry>()
  const add = (path: string, lastmod: string | null = null) => {
    // The first claim on a path wins: a route of its own over the page tree.
    if (!entries.has(path)) entries.set(path, { path, lastmod: lastmod && w3cDate(lastmod) })
  }

  for (const path of FIXED_PATHS) add(path)

  // Depth first in menu order. Link rows are never served, and their children
  // are never built (page-tree.ts); orphans and cycles are already left out.
  const visit = (nodes: PageTree["roots"]) => {
    for (const node of nodes) {
      if (node.kind !== "page") continue
      add(node.path, COMPOSED_PATHS.has(node.path) ? null : sources.pageUpdatedAt.get(node.id))
      visit(node.children)
    }
  }
  visit(sources.tree.roots)

  const articleYears = new Set<number>()
  const usedCategories = new Set<number>()
  for (const article of sources.articles) {
    add(`/artiklar/${article.slug}`, article.updated_at)
    if (article.published_at) articleYears.add(stockholmYear(article.published_at))
    if (article.category_id !== null) usedCategories.add(article.category_id)
  }
  // An empty category or year answers, but with nothing on it.
  for (const category of sources.categories) {
    if (usedCategories.has(category.id)) add(`/artiklar/kategori/${category.slug}`)
  }
  for (const year of [...articleYears].sort((a, b) => b - a)) add(`/artiklar/ar/${year}`)

  for (const event of sources.events) add(`/kalender/${event.slug}`, event.updated_at)
  for (const slug of sources.lokalSlugs) add(`/lokaler/${slug}`)
  for (const slug of sources.speciesSlugs) add(`/arter/${slug}`)

  // This year lives at the plain URL; its year URL 301s there.
  const thisYear = stockholmYear(sources.now)
  const pastYears = [...new Set(sources.obsarYears)]
    .filter((year) => year < thisYear)
    .sort((a, b) => b - a)
  for (const year of pastYears) add(`/obsar/arslista/${year}`)
  for (const year of pastYears) add(`/obsar/ligan/${year}`)

  return [...entries.values()]
}

export function renderSitemap(origin: string, entries: readonly SitemapEntry[]): string {
  const urls = entries.map((entry) => {
    const loc = `<loc>${escapeXml(new URL(entry.path, origin).href)}</loc>`
    return `<url>${loc}${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ""}</url>`
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
  ].join("\n")
}
