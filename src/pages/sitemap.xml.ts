import type { APIRoute } from "astro"
import { SITE_ORIGIN } from "@/lib/canonical-host"
import { obsarStore, store } from "@/lib/obsar-data"
import { listPublicLokaler, listPublicSpecies } from "@/lib/public-alerts"
import { listSitemapContent } from "@/lib/public-content"
import { renderSitemap, sitemapEntries } from "@/lib/sitemap"
import { buildSpecies } from "@/lib/species"

export const prerender = false

/**
 * Every public page, for search engines (src/lib/sitemap.ts says what is in it
 * and what isn't). robots.txt points here. The pages render on demand, so this
 * does too, from the same reads they make: the `to anon` policies for the
 * site's own tables, the larm backend's lokaler and species (no member data
 * in either), and the Obsar KV store.
 *
 * Always written with the apex's address, the one the site has
 * (canonical-host.ts), whichever host asked.
 */

/**
 * Search engines read a sitemap a few times a day at most, and the lokaler and
 * species reads sweep the whole larm log: an hour keeps both trivial.
 */
const SITEMAP_CACHE_CONTROL = "public, max-age=3600"

function unavailable(): Response {
  return new Response("sitemap_unavailable", {
    status: 503,
    headers: { "content-type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  })
}

export const GET: APIRoute = async ({ locals }) => {
  const db = locals.db
  const kv = obsarStore()
  if (!db || !kv) return unavailable()

  const [content, lokaler, app, names, history] = await Promise.all([
    listSitemapContent(db),
    listPublicLokaler(),
    listPublicSpecies(),
    store.readNames(kv).catch(() => undefined),
    store.readHistory(kv).catch(() => undefined),
  ])
  // A missing key (null) is an empty store, as the pages read it; a failed
  // read (undefined) would drop URLs that still answer.
  if (!content || !lokaler.ok || !app.ok || names === undefined || history === undefined) {
    return unavailable()
  }

  // The same list the species pages resolve their slugs against.
  const taxa = Object.entries(names ?? {}).map(([id, one]) => ({ id: Number(id), ...one }))
  const species = buildSpecies(taxa, app.value)

  const entries = sitemapEntries({
    ...content,
    lokalSlugs: lokaler.value.map((lokal) => lokal.slug),
    speciesSlugs: species.map((one) => one.slug),
    obsarYears: history?.years.map((one) => one.year) ?? [],
    now: new Date(),
  })

  return new Response(renderSitemap(SITE_ORIGIN, entries), {
    status: 200,
    headers: {
      // nosniff is set on every response, so this has to be exactly right.
      "content-type": "application/xml; charset=utf-8",
      "Cache-Control": SITEMAP_CACHE_CONTROL,
    },
  })
}
