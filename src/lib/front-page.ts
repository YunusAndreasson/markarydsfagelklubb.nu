import type { PublicAlert } from "./alert-dto"
import { RARITY_WORTH_SAYING } from "./rarity"
import { startOfStockholmDay } from "./stockholm-time"
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

/**
 * Up to `count` articles with a photo become tiles; the rest stay a list, in order.
 * Posts about one event often share a photo, and two identical tiles read as a
 * mistake, so a repeat stays in the list.
 */
export function splitFeatured<T extends { image: TeaserImage | null }>(
  articles: T[],
  count: number
): { tiles: T[]; list: T[] } {
  const seen = new Set<string>()
  const tiles: T[] = []
  for (const article of articles) {
    if (!article.image || tiles.length === count) continue
    if (article.image.src && seen.has(article.image.src)) continue
    seen.add(article.image.src)
    tiles.push(article)
  }
  return { tiles, list: articles.filter((article) => !tiles.includes(article)) }
}

/**
 * An article whose photo is the lead's own loses it here, so one bird doesn't
 * open the page and then the first tile. It stays on the page as text.
 */
export function withoutPhoto<T extends { image: TeaserImage | null }>(
  articles: T[],
  src: string | null | undefined
): T[] {
  if (!src) return articles
  return articles.map((article) =>
    article.image?.src === src ? { ...article, image: null } : article
  )
}

/** Older than this, a photo is history, not news: it belongs on /larm, not up front. */
const PRINT_MAX_AGE_DAYS = 30

/**
 * The newest larm with a photo from the past month, reaching past a busy day of
 * photo-less reports. Few or none on a quiet stretch, which the band takes in its
 * stride: an old bird dated months back would make the page look abandoned.
 *
 * `alerts` is newest first, as the feed returns it.
 */
export function latestPrints<T extends { photoUrl: string | null; observedAt: string }>(
  alerts: readonly T[],
  count: number,
  now: Date
): T[] {
  const oldest = now.getTime() - PRINT_MAX_AGE_DAYS * 86_400_000
  return alerts
    .filter((alert) => alert.photoUrl !== null && new Date(alert.observedAt).getTime() >= oldest)
    .slice(0, count)
}

/**
 * The newest larm with a photo become prints in a rail. Every larm without one
 * that is newer than the last print is listed under it, uncapped, so a rare bird
 * reported without a picture is never hidden behind older photos. With no photos
 * at all, the newest `count` are listed instead. For "Fler larm" under a larm,
 * which has no day list above it.
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

export type DayListSpecies = {
  name: string
  /** The newest larm of the species that day, which its name links to. */
  alertId: string
  /** "Ovanlig" and rarer, which the band marks. */
  notable: boolean
}

export type DayList = {
  /** An instant inside the day the list is for. */
  day: string
  isToday: boolean
  species: DayListSpecies[]
}

/**
 * What the home page's band says (docs/design.md, "Larmbandet"): the species of
 * the newest day with larm, the most notable first and otherwise newest first.
 * Only birds count, so the app's "Övrigt (ej fågel)", the one species without a
 * scientific name, stays out of it. However old that day is: the band says when it
 * was, so a quiet winter reads as quiet, not as broken. Null with no larm at all.
 *
 * `alerts` is newest first, as the feed returns it.
 */
export function buildDayList(
  alerts: Pick<PublicAlert, "id" | "species" | "scientificName" | "rarity" | "observedAt">[],
  now: Date
): DayList | null {
  const birds = alerts.filter((alert) => alert.scientificName !== "")
  const newest = birds[0]
  if (!newest) return null

  const dayOf = (value: Date | string) => startOfStockholmDay(value).getTime()
  const day = dayOf(newest.observedAt)

  const seen = new Set<string>()
  const ofTheDay = birds
    .filter((alert) => dayOf(alert.observedAt) === day)
    .filter((alert) => !seen.has(alert.species) && Boolean(seen.add(alert.species)))
  // A stable sort, so each rarity level keeps the feed's newest-first order.
  const species = ofTheDay
    .map((alert) => ({ alert, notable: alert.rarity <= RARITY_WORTH_SAYING }))
    .sort(
      (a, b) =>
        Number(b.notable) - Number(a.notable) || (b.notable ? a.alert.rarity - b.alert.rarity : 0)
    )
    .map(({ alert, notable }) => ({ name: alert.species, alertId: alert.id, notable }))
  return { day: newest.observedAt, isToday: day === dayOf(now), species }
}

/** Up to this many species, the band names them all: the names are the news. */
const NAME_ALL_UP_TO = 3
const NOTABLE_NAMED = 2

/**
 * Which species the band's sentence names. On a quiet day that is every one, since
 * "1 art" says less than "kungsfiskare". On a big day, only the notable ones.
 */
export function namedSpecies(species: readonly DayListSpecies[]): DayListSpecies[] {
  if (species.length <= NAME_ALL_UP_TO) return [...species]
  return species.filter((one) => one.notable).slice(0, NOTABLE_NAMED)
}
