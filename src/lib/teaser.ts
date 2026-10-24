import {
  isSiteMediaUrl,
  type MediaImage,
  mediaFallbackUrl,
  mediaSrcset,
  srcsetIsSiteMedia,
} from "./media"

/**
 * What an article shows of itself in a list: a photo and an opening line
 * (docs/design.md, "Tidskriften").
 *
 * The WordPress import set a cover on 8 of 353 posts, because a cover that the
 * body also shows would print twice on the article page. But 222 posts carry
 * photos in the body, so a list that reads only `cover` hides nearly all of
 * them. This reads the first good one out of the stored body instead, and the
 * article page itself is unchanged.
 *
 * The body was sanitized on save (`sanitize.ts`), which is what makes a regex
 * reader safe here: every attribute is `name="value"`, `& < > "` are escaped
 * (so a `>` never appears inside a tag), and tags close with ` />`. Attribute
 * *order* is not fixed — the editor and the import write them differently — so
 * attributes are read by name.
 */

export type TeaserImage = {
  src: string
  srcset: string
  width: number
  /** 0 when the stored tag doesn't say. Such an image never leads. */
  height: number
  alt: string
}

/** A photo at least this wide, and this much wider than tall, can lead. */
const HERO_WIDTH = 960
const LANDSCAPE = 1.2
/** Narrower than this, a photo blurs even as a list tile. */
const TILE_WIDTH = 480
/** The opening photos are the ones the writer chose to show first. */
const SCANNED = 6

const IMG_TAG = /<img\s[^>]*>/g
const ATTRIBUTE = /([a-z-]+)="([^"]*)"/g

/** sanitize-html escapes these four; `&amp;` goes last so `&amp;lt;` stays `&lt;`. */
function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
}

function attributesOf(tag: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const [, name, value] of tag.matchAll(ATTRIBUTE)) {
    if (name !== undefined && value !== undefined && !found.has(name)) {
      found.set(name, decodeEntities(value))
    }
  }
  return found
}

const positiveInteger = (value: string | undefined): number =>
  value !== undefined && /^\d+$/.test(value) ? Number(value) : 0

/** The widest `480w` descriptor in a srcset, or 0. */
function widestCandidate(srcset: string): number {
  let widest = 0
  for (const candidate of srcset.split(",")) {
    const match = /\s(\d+)w$/.exec(candidate.trim())
    if (match) widest = Math.max(widest, Number(match[1]))
  }
  return widest
}

/** The site's own images in a stored body, in order, up to `limit`. */
export function bodyImages(html: string, limit = Number.POSITIVE_INFINITY): TeaserImage[] {
  const images: TeaserImage[] = []
  for (const [tag] of html.matchAll(IMG_TAG)) {
    if (images.length >= limit) break
    const attributes = attributesOf(tag)
    const src = attributes.get("src") ?? ""
    const srcset = attributes.get("srcset") ?? ""
    // Already true of anything the sanitizer let through; checked again
    // because this is about to become an <img> on the home page.
    if (!isSiteMediaUrl(src) || (srcset !== "" && !srcsetIsSiteMedia(srcset))) continue

    const width = positiveInteger(attributes.get("width"))
    const height = positiveInteger(attributes.get("height"))
    const known = width > 0 && height > 0
    images.push({
      src,
      srcset,
      width: known ? width : width || widestCandidate(srcset),
      height: known ? height : 0,
      alt: attributes.get("alt") ?? "",
    })
  }
  return images
}

export function isHeroWorthy(image: TeaserImage): boolean {
  return image.height > 0 && image.width >= HERO_WIDTH && image.width / image.height >= LANDSCAPE
}

export function coverImage(cover: MediaImage): TeaserImage {
  return {
    src: mediaFallbackUrl(cover),
    srcset: mediaSrcset(cover),
    width: cover.width,
    height: cover.height,
    alt: cover.alt,
  }
}

/**
 * The cover when the editor chose one. Otherwise the first large landscape
 * photo among the body's opening ones, since that crops well to a list's
 * fixed ratio; then any photo wide enough not to blur; then none.
 */
export function pickTeaserImage(cover: MediaImage | null, html: string): TeaserImage | null {
  if (cover) return coverImage(cover)
  const images = bodyImages(html, SCANNED)
  return images.find(isHeroWorthy) ?? images.find((image) => image.width >= TILE_WIDTH) ?? null
}

const PARAGRAPH = /<p>([\s\S]*?)<\/p>/g
/** The import turns a figcaption into the paragraph right after its image. */
const ENDS_WITH_IMAGE = /<img\s[^>]*\/>\s*(?:<\/p>)?\s*$/
/** A photo credit is never an opening line, wherever it sits. */
const PHOTO_CREDIT = /\bfoto\s*:/i
const TRAILING_PUNCTUATION = /[\s.,;:!?–-]+$/

function plainText(fragment: string): string {
  const text = fragment.replace(/<br\s*\/?>/g, " ").replace(/<[^>]*>/g, "")
  // `\s` covers U+00A0, which the import leaves in text as a literal.
  return decodeEntities(text).replace(/\s+/g, " ").trim()
}

const comparable = (text: string) => text.toLocaleLowerCase("sv").replace(TRAILING_PUNCTUATION, "")

function cut(text: string, max: number): string {
  if (text.length <= max) return text
  const slice = text.slice(0, max + 1)
  const space = slice.lastIndexOf(" ")
  const head = space > max * 0.6 ? slice.slice(0, space) : text.slice(0, max)
  return `${head.replace(TRAILING_PUNCTUATION, "")}…`
}

/**
 * The body's opening line, as plain text for a list. Render it with `{}`,
 * never `set:html`.
 *
 * Skipped: empty paragraphs, a paragraph holding an image, the caption after
 * one, a photo credit, and a line that only repeats the title. Two untitled
 * WordPress posts took their first bold line as the title, so their opening
 * paragraph begins with that line and a `<br>`; the line is dropped and the
 * rest kept. Prose that merely starts with the title's words is left alone.
 */
export function teaserText(html: string, title: string, max = 180): string {
  const heading = comparable(title.trim())
  for (const match of html.matchAll(PARAGRAPH)) {
    const inner = match[1] ?? ""
    if (inner.includes("<img")) continue
    if (ENDS_WITH_IMAGE.test(html.slice(0, match.index))) continue

    const [firstLine = "", ...otherLines] = inner.split(/<br\s*\/?>/)
    const repeatsTitle = heading !== "" && comparable(plainText(firstLine)) === heading
    const text = plainText(repeatsTitle ? otherLines.join(" ") : inner)
    if (text === "" || PHOTO_CREDIT.test(text)) continue
    return cut(text, max)
  }
  return ""
}
