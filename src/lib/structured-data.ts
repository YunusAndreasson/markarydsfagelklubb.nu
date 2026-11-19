import { SITE_ORIGIN } from "./canonical-host"
import { stockholmIsoDate, stockholmIsoDateTime } from "./stockholm-time"

/**
 * Structured data for search engines (schema.org, as JSON-LD). Every public
 * page carries one graph in its head (site.astro): the club, and the page's own
 * nodes, which name the club by its `@id` rather than repeat it. A page with
 * crumbs adds its BreadcrumbList from PageHeader.astro, the one place that
 * knows the trail.
 */

export type JsonLd = Record<string, unknown>

export const SITE_NAME = "Markaryds Fågelklubb"

export const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`
const CLUB = { "@id": ORGANIZATION_ID }

/** A block's text. `<` is escaped so no stored text can close the script element. */
export function jsonLdText(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}

/** A page's nodes as one graph, under one context. */
export function jsonLdGraph(nodes: readonly JsonLd[]): JsonLd {
  return { "@context": "https://schema.org", "@graph": nodes }
}

/** The site itself, on the home page: what gives a search result the site's name. */
export function websiteNode(): JsonLd {
  return {
    "@type": "WebSite",
    "@id": `${SITE_ORIGIN}/#website`,
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    publisher: CLUB,
  }
}

type EventFacts = {
  title: string
  summary: string
  place: string
  starts_at: string
  ends_at: string | null
  all_day: boolean
}

/**
 * One event of the programme. An all-day event gives its days alone, a timed
 * one its clock with Stockholm's offset. The table has no cancelled state
 * (`status` is the publishing state, and only published rows reach a visitor),
 * so every event is scheduled. Without a place it is somewhere in the kommun.
 */
export function eventNode(event: EventFacts, url: string): JsonLd {
  const when = event.all_day ? stockholmIsoDate : stockholmIsoDateTime
  const summary = event.summary.trim()
  return {
    "@type": "Event",
    name: event.title,
    ...(summary ? { description: summary } : {}),
    url,
    startDate: when(event.starts_at),
    ...(event.ends_at ? { endDate: when(event.ends_at) } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.place.trim() || "Markaryds kommun",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Markaryd",
        addressRegion: "Kronobergs län",
        addressCountry: "SE",
      },
    },
    organizer: CLUB,
  }
}

/** The longest headline Google takes in Article markup. */
export const HEADLINE_MAX = 110

/** A title cut to `max` characters at a word, with an ellipsis; a shorter one as it is. */
export function capHeadline(title: string, max = HEADLINE_MAX): string {
  const characters = Array.from(title.trim())
  if (characters.length <= max) return characters.join("")
  // Room for the ellipsis. A cut that lands on a space keeps the word before it.
  const head = characters.slice(0, max - 1).join("")
  const atSpace = /\s/u.test(characters[max - 1] ?? "")
  const space = head.lastIndexOf(" ")
  // A word longer than half the headline is cut where it is.
  const words = atSpace || space <= max / 2 ? head : head.slice(0, space)
  return `${words.replace(/[\s,.;:–—-]+$/u, "")}…`
}

type ArticleFacts = { title: string; published_at: string; updated_at: string }

/**
 * One article, with the club as its author and publisher. `updated_at` is the
 * row's last save, which for an imported post is the import; an article saved
 * before its scheduled time counts as modified when it was published.
 */
export function articleNode(article: ArticleFacts, url: string, image: string | null): JsonLd {
  const published = new Date(article.published_at)
  const updated = new Date(article.updated_at)
  return {
    "@type": "Article",
    headline: capHeadline(article.title),
    datePublished: stockholmIsoDateTime(published),
    dateModified: stockholmIsoDateTime(updated > published ? updated : published),
    ...(image ? { image: new URL(image, SITE_ORIGIN).href } : {}),
    author: CLUB,
    publisher: CLUB,
    mainEntityOfPage: url,
  }
}

type CrumbLink = { href: string; label: string }

/**
 * The trail a page shows over its title, with the page itself last, on the
 * site's own address. Null without crumbs: a trail of one says nothing.
 */
export function breadcrumbList(
  crumbs: readonly CrumbLink[],
  page: { name: string; url: string }
): JsonLd | null {
  if (crumbs.length === 0) return null
  const steps = [
    ...crumbs.map((crumb) => ({ name: crumb.label, url: new URL(crumb.href, SITE_ORIGIN).href })),
    page,
  ]
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: steps.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      item: step.url,
    })),
  }
}
