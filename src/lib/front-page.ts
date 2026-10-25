import { isHeroWorthy, type TeaserImage } from "./teaser"

/**
 * What goes where on the home page (docs/design.md, "Tidskriften"). Pure, so
 * the editorial rules are tested rather than buried in a template.
 */

/** How far down the newest articles the lead may come from. */
const LEAD_WINDOW = 4

/**
 * The lead is the newest of the latest four with a large landscape photo, so
 * the page opens on a picture rather than on "Inställt arbetsmöte" at 72 px.
 * When none of them has one, the newest leads as plain type. The rest keep
 * their order.
 */
export function pickLead<T extends { image: TeaserImage | null }>(
  articles: T[]
): { lead: T | null; rest: T[] } {
  const found = articles
    .slice(0, LEAD_WINDOW)
    .findIndex((article) => article.image !== null && isHeroWorthy(article.image))
  const index = found === -1 ? 0 : found
  const lead = articles[index] ?? null
  return { lead, rest: articles.filter((_, i) => i !== index) }
}

/** Up to `count` articles with a photo become tiles; the rest stay a list, in order. */
export function splitFeatured<T extends { image: TeaserImage | null }>(
  articles: T[],
  count: number
): { tiles: T[]; list: T[] } {
  const tiles = articles.filter((article) => article.image !== null).slice(0, count)
  return { tiles, list: articles.filter((article) => !tiles.includes(article)) }
}

/**
 * The newest larm with a photo become prints in the rail. Every larm without
 * one that is newer than the last print is listed under it, uncapped, so a
 * rare bird reported without a picture is never hidden behind older photos.
 * With no photos at all, the newest `count` are listed instead.
 *
 * `alerts` is newest first, as the feed returns it.
 */
export function splitLarm<T extends { photoUrl: string | null }>(
  alerts: T[],
  count: number
): { prints: T[]; plain: T[] } {
  const prints = alerts.filter((alert) => alert.photoUrl !== null).slice(0, count)
  const last = prints.at(-1)
  if (!last) return { prints: [], plain: alerts.slice(0, count) }
  const newer = alerts.slice(0, alerts.indexOf(last))
  return { prints, plain: newer.filter((alert) => alert.photoUrl === null) }
}
