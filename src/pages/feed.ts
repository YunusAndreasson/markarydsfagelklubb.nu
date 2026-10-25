import type { APIRoute } from "astro"
import { listPublishedArticles } from "@/lib/public-content"
import { renderRss } from "@/lib/rss"

export const prerender = false

/**
 * The articles as RSS (src/lib/rss.ts). At `/feed` because that is where
 * WordPress had it: the old `/feed/` 301s here, so existing subscribers stay.
 *
 * It publishes what /artiklar publishes: the `to anon` policy is the only
 * filter, so a draft or a scheduled article can't reach a reader.
 */

/** The newest twenty, as /artiklar's first page shows. */
const FEED_ITEMS = 20

/**
 * Readers poll every hour or so, and the club publishes a few articles a
 * month: an hour keeps the load trivial and a new article out the same day.
 */
const FEED_CACHE_CONTROL = "public, max-age=3600"

export const GET: APIRoute = async ({ locals, url }) => {
  const db = locals.db
  const page = db ? await listPublishedArticles(db, { limit: FEED_ITEMS }) : null
  if (!page) {
    return new Response("feed_unavailable", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    })
  }

  const body = renderRss(
    {
      title: "Markaryds Fågelklubb",
      description: "Nyheter och exkursionsreferat från Markaryds Fågelklubb.",
      link: new URL("/artiklar", url.origin).href,
      self: new URL("/feed", url.origin).href,
    },
    page.articles.map((article) => ({
      title: article.title,
      link: new URL(`/artiklar/${article.slug}`, url.origin).href,
      publishedAt: article.published_at,
      description: article.standfirst,
      category: article.category?.name ?? null,
      image: article.image
        ? {
            url: new URL(article.image.src, url.origin).href,
            width: article.image.width,
            height: article.image.height,
          }
        : null,
    }))
  )

  return new Response(body, {
    status: 200,
    headers: {
      // nosniff is set on every response, so this has to be exactly right.
      "content-type": "application/rss+xml; charset=utf-8",
      "Cache-Control": FEED_CACHE_CONTROL,
    },
  })
}
