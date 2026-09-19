import { type Cursor, newerThan, olderThan } from "./keyset"
import type { MediaFormat, MediaImage } from "./media"
import { buildMenu, buildPageTree, type MenuEntry, type PageRow, type PageTree } from "./page-tree"
import type { SupabasePublicClient } from "./supabase-public"

/**
 * What public pages read, as an anonymous visitor would (`locals.db`). The
 * `to anon` policies already limit every table to published, due rows, so no
 * query here repeats that rule: a draft can't leak through a forgotten filter.
 */

export type PublicPageRow = PageRow & { description: string }

export type SiteNavigation = { tree: PageTree; menu: MenuEntry[] }

const EMPTY_NAVIGATION: SiteNavigation = {
  tree: { roots: [], byId: new Map(), unreachable: [] },
  menu: [],
}

/** The page tree and the menu. A failure costs the menu, never the page. */
export async function loadNavigation(db: SupabasePublicClient): Promise<SiteNavigation> {
  const { data, error } = await db
    .from("pages")
    .select("id, parent_id, kind, slug, title, link_url, show_in_menu, sort_order, description")
    .overrideTypes<PublicPageRow[], { merge: false }>()
  if (error) {
    console.error(`mafk-web: load navigation failed — ${error.message}`)
    return EMPTY_NAVIGATION
  }
  const tree = buildPageTree(data)
  if (tree.unreachable.length > 0) {
    console.error(`mafk-web: pages unreachable from the top: ${tree.unreachable.join(", ")}`)
  }
  return { tree, menu: buildMenu(tree) }
}

export type ArticleSummary = {
  id: number
  slug: string
  title: string
  excerpt: string
  published_at: string
  author_name: string
  category: { name: string; slug: string } | null
  cover: (MediaImage & { id: number }) | null
}

const SUMMARY_COLUMNS =
  "id, slug, title, excerpt, published_at, author_name, category:categories(name, slug), cover:media(id, storage_prefix, format, widths, width, height, alt)"

type SummaryRow = Omit<ArticleSummary, "cover" | "published_at"> & {
  published_at: string | null
  cover: (Omit<MediaImage, "format"> & { id: number; format: string }) | null
}

function toSummary(row: SummaryRow): ArticleSummary {
  return {
    ...row,
    // Always set for a published article (articles_published_has_time).
    published_at: row.published_at ?? "",
    cover: row.cover ? { ...row.cover, format: row.cover.format as MediaFormat } : null,
  }
}

export type ArticlePage = {
  articles: ArticleSummary[]
  /** Cursor for the next, older page, if there is one. */
  older: Cursor | null
  /** Cursor for the previous, newer page, if this isn't the first. */
  newer: Cursor | null
}

const cursorOf = (article: ArticleSummary): Cursor => ({
  publishedAt: article.published_at,
  id: article.id,
})

/**
 * A page of articles, newest first, optionally in one category. `before`
 * pages towards older articles, `after` back towards newer ones.
 */
export async function listPublishedArticles(
  db: SupabasePublicClient,
  options: { limit: number; categoryId?: number; before?: Cursor | null; after?: Cursor | null }
): Promise<ArticlePage | null> {
  const { limit, categoryId, before, after } = options
  // Paging back towards newer articles reads ascending, then flips.
  const ascending = Boolean(after && !before)
  let query = db.from("articles").select(SUMMARY_COLUMNS)
  if (categoryId !== undefined) query = query.eq("category_id", categoryId)
  if (before) query = query.or(olderThan(before))
  else if (after) query = query.or(newerThan(after))

  const { data, error } = await query
    .order("published_at", { ascending })
    .order("id", { ascending })
    .limit(limit + 1)
    .overrideTypes<SummaryRow[], { merge: false }>()
  if (error) {
    console.error(`mafk-web: list articles failed — ${error.message}`)
    return null
  }

  const hasMore = data.length > limit
  const rows = data.slice(0, limit).map(toSummary)
  const articles = ascending ? rows.reverse() : rows
  const first = articles[0]
  const last = articles[articles.length - 1]
  return {
    articles,
    older: (ascending ? Boolean(after) : hasMore) && last ? cursorOf(last) : null,
    newer: (ascending ? hasMore : Boolean(before)) && first ? cursorOf(first) : null,
  }
}

export type FullArticle = ArticleSummary & { body_html: string; category_id: number | null }

export async function loadPublishedArticle(
  db: SupabasePublicClient,
  slug: string
): Promise<FullArticle | null | "error"> {
  const { data, error } = await db
    .from("articles")
    .select(`${SUMMARY_COLUMNS}, body_html, category_id`)
    .eq("slug", slug)
    .maybeSingle()
    .overrideTypes<
      (SummaryRow & { body_html: string; category_id: number | null }) | null,
      { merge: false }
    >()
  if (error) {
    console.error(`mafk-web: load article failed — ${error.message}`)
    return "error"
  }
  return data
    ? { ...toSummary(data), body_html: data.body_html, category_id: data.category_id }
    : null
}

export async function listPublicCategories(db: SupabasePublicClient) {
  const { data, error } = await db
    .from("categories")
    .select("id, slug, name")
    .order("sort_order")
    .order("name")
  if (error) console.error(`mafk-web: list categories failed — ${error.message}`)
  return data ?? []
}

export async function loadPageBody(db: SupabasePublicClient, id: number) {
  const { data, error } = await db
    .from("pages")
    .select("id, title, description, body_html")
    .eq("id", id)
    .maybeSingle()
  if (error) console.error(`mafk-web: load page failed — ${error.message}`)
  return error ? "error" : data
}
