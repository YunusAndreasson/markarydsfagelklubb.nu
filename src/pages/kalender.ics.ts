import type { APIRoute } from "astro"
import { renderCalendar } from "@/lib/ical"
import { listEventsForFeed } from "@/lib/public-content"

export const prerender = false

/**
 * The programme as a calendar subscription (docs/roadmap.md, F3). A member
 * adds this URL once and the club's events appear in their own calendar,
 * including the ones added later.
 *
 * It publishes exactly what /kalender publishes: the `to anon` policy is the
 * only filter, so a draft or a scheduled event can't reach a subscriber.
 */

/** A year back, so a new subscriber keeps the season just gone. */
const MONTHS_BACK = 12

/**
 * The club plans a year at a time and runs a couple of events a month, so this
 * is far above the whole programme. It exists because Supabase caps responses
 * at 1000 rows and a silent truncation would be worse than a short feed.
 */
const FEED_LIMIT = 500

/**
 * Calendar clients poll, typically every few hours, and none of them respects
 * a short max-age for long. An hour keeps the load trivial while a new event
 * still reaches subscribers the same day it is published.
 */
const FEED_CACHE_CONTROL = "public, max-age=3600"

export const GET: APIRoute = async ({ locals, url }) => {
  const db = locals.db
  if (!db) {
    return new Response("service_unavailable", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    })
  }

  const now = new Date()
  const from = new Date(now)
  from.setUTCMonth(from.getUTCMonth() - MONTHS_BACK)

  const events = await listEventsForFeed(db, { from, limit: FEED_LIMIT })
  if (!events) {
    return new Response("kalender_unavailable", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    })
  }

  const body = renderCalendar(events, { origin: url.origin, now })
  return new Response(body, {
    status: 200,
    headers: {
      // nosniff is set on every response, so this has to be exactly right or
      // calendar clients refuse the feed.
      "content-type": "text/calendar; charset=utf-8",
      // Named, so a download lands as something recognisable rather than
      // "kalender.ics" from the path alone.
      "content-disposition": 'inline; filename="markaryds-fagelklubb.ics"',
      "Cache-Control": FEED_CACHE_CONTROL,
    },
  })
}
