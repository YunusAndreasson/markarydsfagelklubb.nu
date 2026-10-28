import type { TeaserImage } from "./teaser"

/**
 * What goes where on the home page (docs/design.md, "Tidskriften"). Pure, so
 * the editorial rules are tested rather than buried in a template.
 */

/**
 * The newest article always leads, photo or not (2026-10-28). Until then an
 * older article with a wide photo could lead instead, and a programme change
 * ended up below the story it changed. Whether the lead gets the wide photo is
 * the page's call (`isHeroWorthy`); without one it leads as plain type.
 */
export function pickLead<T>(articles: T[]): { lead: T | null; rest: T[] } {
  return { lead: articles[0] ?? null, rest: articles.slice(1) }
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
