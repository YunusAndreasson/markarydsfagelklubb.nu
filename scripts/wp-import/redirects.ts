import { normaliseOldPath } from "../../src/lib/wp-redirects"
import { CATEGORY_MAP } from "./categories"
import { flattenTree, LEGAL_PAGES, LOKAL_MOVES, type TreeEntry } from "./page-tree"
import { siteSlug } from "./transform"

/**
 * The old-URL map the Worker serves (docs/roadmap.md, D6), built from the
 * imported posts, WordPress's categories and the page tree. Pure, so the
 * generator and its test agree on every rule.
 */

export type WpRedirects = {
  /** Old path, normalised (see `normaliseOldPath`) → new path. */
  paths: Record<string, string>
  /** WordPress post or page id → new path, for `/?p=<id>` and `/?page_id=<id>`. */
  ids: Record<string, string>
}

export type RedirectSources = {
  posts: { id: number; slug: string; link: string }[]
  categories: { slug: string; link: string }[]
}

function pathOf(link: string): string {
  return normaliseOldPath(new URL(link).pathname)
}

function target(entry: TreeEntry, path: string): string {
  return entry.kind === "link" ? entry.url : path
}

export function buildRedirects({ posts, categories }: RedirectSources): WpRedirects {
  const paths: Record<string, string> = {}
  const ids: Record<string, string> = {}
  const add = (from: string, to: string) => {
    const key = normaliseOldPath(from)
    if (key === to) return
    if (paths[key] !== undefined && paths[key] !== to) {
      throw new Error(`${key} would redirect to both ${paths[key]} and ${to}`)
    }
    paths[key] = to
  }

  for (const post of posts) {
    const to = `/artiklar/${siteSlug(post.slug)}`
    add(pathOf(post.link), to)
    ids[String(post.id)] = to
  }

  for (const category of categories) {
    const site = CATEGORY_MAP[category.slug]
    add(pathOf(category.link), site ? `/artiklar/kategori/${site}` : "/artiklar")
  }

  for (const { entry, path } of flattenTree()) {
    for (const from of entry.from) add(from, target(entry, path))
    if (entry.kind === "page" && entry.wpId !== null) ids[String(entry.wpId)] = path
  }
  for (const [from, to] of Object.entries(LOKAL_MOVES)) add(from, to)
  // The app's links use the root form; the pages live under /om-foreningen.
  for (const slug of LEGAL_PAGES) add(`/${slug}`, `/om-foreningen/${slug}`)

  return { paths: sortKeys(paths), ids: sortKeys(ids) }
}

function sortKeys(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)))
}
