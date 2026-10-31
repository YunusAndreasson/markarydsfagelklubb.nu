import { type Cursor, newerThan, olderThan } from "./keyset"
import type { LokalPointRow } from "./lokal-points"
import type { MediaFormat, MediaImage } from "./media"
import { buildMenu, buildPageTree, type MenuEntry, type PageRow, type PageTree } from "./page-tree"
import { searchFilter } from "./search"
import { startOfStockholmMonth, stockholmYear } from "./stockholm-time"
import type { SupabasePublicClient } from "./supabase-public"
import {
  type LeadOpening,
  leadOpening,
  pickTeaserImage,
  type TeaserImage,
  teaserText,
} from "./teaser"

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

/**
 * An article as a list shows it: with a photo and an opening line, both read
 * out of the body when the editor set neither (src/lib/teaser.ts).
 */
export type ArticleTeaser = ArticleSummary & {
  image: TeaserImage | null
  /** The hand-written excerpt, or the body's opening line. Plain text. */
  standfirst: string
  /** The opening the home page's lead shows. */
  opening: LeadOpening
}

/**
 * Lists read the body to find its photo and opening line. Bodies average
 * 1.5 KB (the longest is 11.5 KB), so a page of 20 costs about 30 KB from the
 * database. If that ever grows, a generated column holding the first `<img>`
 * and paragraph is the way out.
 */
const TEASER_COLUMNS = `${SUMMARY_COLUMNS}, body_html`

function toTeaser({ body_html, ...row }: SummaryRow & { body_html: string }): ArticleTeaser {
  const summary = toSummary(row)
  return {
    ...summary,
    image: pickTeaserImage(summary.cover, body_html),
    standfirst: summary.excerpt || teaserText(body_html, summary.title),
    opening: leadOpening(body_html, summary.title),
  }
}

export type ArticlePage = {
  articles: ArticleTeaser[]
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
  options: {
    limit: number
    categoryId?: number
    /** Only this calendar year, in Stockholm time. */
    year?: number
    /** A normalised query (`lib/search.ts`). */
    search?: string
    before?: Cursor | null
    after?: Cursor | null
  }
): Promise<ArticlePage | null> {
  const { limit, categoryId, year, search, before, after } = options
  // Paging back towards newer articles reads ascending, then flips.
  const ascending = Boolean(after && !before)
  let query = db.from("articles").select(TEASER_COLUMNS)
  if (categoryId !== undefined) query = query.eq("category_id", categoryId)
  if (year !== undefined) {
    query = query
      .gte("published_at", startOfStockholmMonth(year, 1).toISOString())
      .lt("published_at", startOfStockholmMonth(year + 1, 1).toISOString())
  }
  if (search) query = query.or(searchFilter(search))
  if (before) query = query.or(olderThan(before))
  else if (after) query = query.or(newerThan(after))

  const { data, error } = await query
    .order("published_at", { ascending })
    .order("id", { ascending })
    .limit(limit + 1)
    .overrideTypes<(SummaryRow & { body_html: string })[], { merge: false }>()
  if (error) {
    console.error(`mafk-web: list articles failed — ${error.message}`)
    return null
  }

  const hasMore = data.length > limit
  const rows = data.slice(0, limit).map(toTeaser)
  const articles = ascending ? rows.reverse() : rows
  const first = articles[0]
  const last = articles.at(-1)
  return {
    articles,
    older: (ascending ? Boolean(after) : hasMore) && last ? cursorOf(last) : null,
    newer: (ascending ? hasMore : Boolean(before)) && first ? cursorOf(first) : null,
  }
}

/** Every year with articles, newest first, for the archive. Empty on a failed read. */
export async function listArticleYears(db: SupabasePublicClient, now: Date): Promise<number[]> {
  const { data, error } = await db
    .from("articles")
    .select("published_at")
    .order("published_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) console.error(`mafk-web: article years failed — ${error.message}`)
  if (error || !data?.published_at) return []
  const newest = stockholmYear(now)
  const oldest = stockholmYear(data.published_at)
  return Array.from({ length: newest - oldest + 1 }, (_, index) => newest - index)
}

/** Pages matching a normalised query (`lib/search.ts`), for /sok. Null on a failed read. */
export async function searchPages(db: SupabasePublicClient, search: string, limit: number) {
  const { data, error } = await db
    .from("pages")
    .select("id, title, description")
    .eq("kind", "page")
    .or(searchFilter(search))
    .order("title")
    .limit(limit)
  if (error) {
    console.error(`mafk-web: search pages failed — ${error.message}`)
    return null
  }
  return data
}

/**
 * The places on a lokal, and any lokal it is itself a place on. Empty on a failed
 * read: a lokal page without them still answers where and what was seen.
 */
export async function listLokalPoints(
  db: SupabasePublicClient,
  lokalId: number
): Promise<LokalPointRow[]> {
  const { data, error } = await db
    .from("lokal_points")
    .select(
      "id, location_id, linked_location_id, kind, name, note, latitude, longitude, sort_order"
    )
    .or(`location_id.eq.${lokalId},linked_location_id.eq.${lokalId}`)
  if (error) {
    console.error(`mafk-web: list lokal points failed — ${error.message}`)
    return []
  }
  return data
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

export type EventSummary = {
  id: number
  slug: string
  title: string
  summary: string
  place: string
  kind: string
  starts_at: string
  ends_at: string | null
  all_day: boolean
  contact_name: string
  contact_phone: string
  signup_deadline: string | null
}

const EVENT_COLUMNS =
  "id, slug, title, summary, place, kind, starts_at, ends_at, all_day, contact_name, contact_phone, signup_deadline"

/**
 * The programme, soonest first. "Upcoming" counts an event as upcoming until
 * the day it happens is over, so a morning excursion doesn't vanish from the
 * list while the members are still out.
 */
export async function listUpcomingEvents(
  db: SupabasePublicClient,
  options: { limit: number; from: Date }
): Promise<EventSummary[] | null> {
  const { data, error } = await db
    .from("events")
    .select(EVENT_COLUMNS)
    // Or still on: the second day of a two-day rally belongs in the programme.
    .or(`starts_at.gte."${options.from.toISOString()}",ends_at.gte."${options.from.toISOString()}"`)
    .order("starts_at")
    .order("id")
    .limit(options.limit)
  if (error) {
    console.error(`mafk-web: list upcoming events failed — ${error.message}`)
    return null
  }
  return data
}

/** When the newest event before `before` began, for "Tidigare i programmet". Null if none. */
export async function latestEventStartBefore(
  db: SupabasePublicClient,
  before: Date
): Promise<string | null> {
  const { data, error } = await db
    .from("events")
    .select("starts_at")
    .lt("starts_at", before.toISOString())
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) console.error(`mafk-web: latest past event failed — ${error.message}`)
  return data?.starts_at ?? null
}

/**
 * One month of the programme, for /kalender/2026-10: what starts in it, and what
 * started earlier and runs on into it, like a rally over the turn of the month.
 */
export async function listEventsInMonth(
  db: SupabasePublicClient,
  range: { start: Date; end: Date }
): Promise<EventSummary[] | null> {
  const start = range.start.toISOString()
  const { data, error } = await db
    .from("events")
    .select(EVENT_COLUMNS)
    .or(`starts_at.gte."${start}",ends_at.gte."${start}"`)
    .lt("starts_at", range.end.toISOString())
    .order("starts_at")
    .order("id")
  if (error) {
    console.error(`mafk-web: list events in month failed — ${error.message}`)
    return null
  }
  return data
}

export type FullEvent = EventSummary & { body_html: string; registration_url: string | null }

export async function loadPublishedEvent(
  db: SupabasePublicClient,
  slug: string
): Promise<FullEvent | null | "error"> {
  const { data, error } = await db
    .from("events")
    .select(`${EVENT_COLUMNS}, body_html, registration_url`)
    .eq("slug", slug)
    .maybeSingle()
  if (error) {
    console.error(`mafk-web: load event failed — ${error.message}`)
    return "error"
  }
  return data
}

/**
 * What /kalender.ics publishes. It reaches a year back so a subscriber keeps
 * the season just gone, and forward without limit: the club plans a year at a
 * time, and the whole programme is a few dozen rows.
 */
export async function listEventsForFeed(
  db: SupabasePublicClient,
  options: { from: Date; limit: number }
) {
  const { data, error } = await db
    .from("events")
    .select(`${EVENT_COLUMNS}, updated_at`)
    .gte("starts_at", options.from.toISOString())
    .order("starts_at")
    .limit(options.limit)
  if (error) {
    console.error(`mafk-web: list events for feed failed — ${error.message}`)
    return null
  }
  return data
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
