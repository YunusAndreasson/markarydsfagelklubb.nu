import { createHash } from "node:crypto"
import {
  COLUMN_SIZES,
  type MediaImage,
  mediaFallbackUrl,
  mediaSrcset,
  planImageWidths,
  SUPABASE_ORIGIN,
} from "../../src/lib/media"

/**
 * The pure half of the import: WordPress HTML in, the site's HTML out, and a
 * list of the files that HTML needs. No network, no database, so it is unit
 * tested (transform.test.ts) and the dry run shows exactly what a real run
 * would store.
 */

export const WP_HOSTS = new Set(["markarydsfagelklubb.nu", "www.markarydsfagelklubb.nu"])

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  ndash: "–",
  mdash: "—",
}

/** Titles come from the REST API HTML-encoded (`Nattfåglar &#8211; 5 juni`). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const point =
        code[1]?.toLowerCase() === "x"
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10)
      return Number.isFinite(point) ? String.fromCodePoint(point) : whole
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? whole
  })
}

/** A title as plain text: entities decoded, whitespace collapsed. */
export function cleanTitle(rendered: string): string {
  return decodeEntities(rendered.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * A title for a post that has none (3 of 354): its first bold or heading text,
 * which in both untitled posts with text is visibly the headline. Empty when
 * there is none; the importer then skips the post rather than guess.
 */
export function fallbackTitle(html: string): string {
  for (const match of html.matchAll(/<(strong|b|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = cleanTitle(match[2] ?? "")
    if (text) return text.length > 120 ? `${text.slice(0, 119).trimEnd()}…` : text
  }
  return ""
}

/** WordPress slugs may be percent-encoded Swedish; the site's are `[a-z0-9-]`. */
export function siteSlug(wpSlug: string): string {
  let decoded = wpSlug
  try {
    decoded = decodeURIComponent(wpSlug)
  } catch {
    // Keep it as it came.
  }
  return decoded
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** RFC 4122 version 5 (SHA-1, name-based), so a file keeps its prefix across runs. */
export function uuidV5(name: string): string {
  // A fixed namespace for this import, itself a v4 UUID generated once.
  const namespace = Buffer.from("6f1c2b8e4a7d4c0e9b3f5d2a1e8c7b60", "hex")
  const hash = createHash("sha1").update(namespace).update(name, "utf8").digest()
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x50
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80
  const hex = hash.subarray(0, 16).toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * `YYYY/MM/<uuid>`, the shape `media.storage_prefix` requires. The month is
 * the WordPress upload month when the URL carries one, else `fallback`'s.
 */
export function plannedPrefix(sourceUrl: string, fallback: Date): string {
  const match = /\/wp-content\/uploads\/(\d{4})\/(\d{2})\//.exec(sourceUrl)
  const year = match?.[1] ?? String(fallback.getUTCFullYear())
  const month = match?.[2] ?? String(fallback.getUTCMonth() + 1).padStart(2, "0")
  return `${year}/${month}/${uuidV5(sourceUrl)}`
}

/** WordPress's resized copies: `name-1024x768.jpg` → `name.jpg`. */
export function stripSizeSuffix(url: string): string {
  return url.replace(/-\d+x\d+(\.[a-z0-9]+)$/i, "$1")
}

export function isWpUrl(url: string): boolean {
  try {
    return WP_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

function isWpUpload(url: string): boolean {
  return isWpUrl(url) && new URL(url).pathname.startsWith("/wp-content/uploads/")
}

export type Attachment = {
  id: string
  url: string
  width: number | null
  height: number | null
}

/** What the body needs from storage; the importer fetches these. */
export type ImageNeed = {
  source: string
  /** From another site rather than WordPress's uploads. */
  hotlinked: boolean
  /** Not in the export, so the original's URL is inferred. */
  guessed: boolean
  image: MediaImage
}

export type FileNeed = {
  source: string
  kind: "pdf" | "office" | "image-link" | "other"
  /** Where it goes in site-files, for a pdf or office file; null otherwise. */
  path: string | null
}

/** Documents the old site links to (migration *_site_files.sql). */
export const SITE_FILES_BUCKET = "site-files"

/**
 * `YYYY/MM/<name>` in site-files, from the WordPress upload path, which is
 * unique already. The name is reduced to ASCII, since storage keys are picky.
 */
export function plannedFilePath(source: string): string | null {
  const match = /\/wp-content\/uploads\/(\d{4})\/(\d{2})\/([^/?#]+)$/.exec(new URL(source).pathname)
  if (!match) return null
  let name = match[3] ?? ""
  try {
    name = decodeURIComponent(name)
  } catch {
    // Keep it as it came.
  }
  const safe = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return safe ? `${match[1]}/${match[2]}/${safe}` : null
}

export function siteFileUrl(path: string): string {
  return `${SUPABASE_ORIGIN}/storage/v1/object/public/${SITE_FILES_BUCKET}/${path}`
}

/**
 * A document that couldn't be copied (it is gone on WordPress too): its links
 * become their plain text, rather than pointing at a file that isn't there.
 */
export function unlinkFile(html: string, path: string): string {
  const url = siteFileUrl(path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return html.replace(new RegExp(`<a\\s[^>]*href="${url}"[^>]*>([\\s\\S]*?)<\\/a>`, "g"), "$1")
}

export type BodyResult = {
  html: string
  images: ImageNeed[]
  files: FileNeed[]
  /** `<img>`s removed because no original could be identified. */
  droppedImages: string[]
  /** Same-site page links made relative, so the redirect map answers them. */
  internalLinks: string[]
  captions: number
}

export type ResolveContext = {
  /** WordPress attachment id → original. From the WXR export. */
  attachmentsById: ReadonlyMap<string, Attachment>
  /** Original URL → attachment, for images without a `wp-image-<id>` class. */
  attachmentsByUrl: ReadonlyMap<string, Attachment>
  /** The post's date: the storage month for hotlinked images. */
  postDate: Date
  /**
   * Point document links at site-files. Only when the import copies them
   * (`--files`), or the links would break before the cutover.
   */
  rewriteFiles?: boolean
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag)
  if (!match) return null
  return decodeEntities(match[2] ?? match[3] ?? "")
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
}

function resolveOriginal(tag: string, src: string, context: ResolveContext): Attachment | null {
  const id = /\bwp-image-(\d+)\b/.exec(attribute(tag, "class") ?? "")?.[1]
  const byId = id ? context.attachmentsById.get(id) : undefined
  if (byId) return byId
  const normalised = src.replace("://www.markarydsfagelklubb.nu/", "://markarydsfagelklubb.nu/")
  return (
    context.attachmentsByUrl.get(normalised) ??
    context.attachmentsByUrl.get(stripSizeSuffix(normalised)) ??
    null
  )
}

function plannedImage(
  source: string,
  width: number | null,
  height: number | null,
  alt: string,
  postDate: Date
): MediaImage {
  const w = width ?? 0
  return {
    storage_prefix: plannedPrefix(source, postDate),
    format: "webp",
    // Unknown dimensions (a hotlink) are planned at the largest width; the
    // real run measures the file and plans again.
    widths: w > 0 ? planImageWidths(w) : [480, 960, 1600],
    width: w > 0 ? w : 1600,
    height: height ?? 0,
    alt,
  }
}

/** The tag the admin's editor writes for a site image (RichTextEditor.tsx). */
export function siteImageTag(image: MediaImage): string {
  const size = image.height > 0 ? ` width="${image.width}" height="${image.height}"` : ""
  return `<img src="${escapeAttribute(mediaFallbackUrl(image))}" srcset="${escapeAttribute(mediaSrcset(image))}" sizes="${COLUMN_SIZES}"${size} alt="${escapeAttribute(image.alt)}" loading="lazy">`
}

function fileKind(url: string): FileNeed["kind"] {
  const extension = new URL(url).pathname.split(".").pop()?.toLowerCase() ?? ""
  if (extension === "pdf") return "pdf"
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(extension)) return "office"
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) return "image-link"
  return "other"
}

/**
 * WordPress body HTML → what the sanitizer is given. It does not sanitize;
 * the caller passes the result through `sanitizeContent`, the site's one gate.
 *
 * - every `<img>` becomes a site image at its planned storage prefix, or is
 *   dropped when nothing identifies its original;
 * - a `<figcaption>` (113 posts, nearly all photo credits) becomes a
 *   paragraph under its image, since the editor has no caption node;
 * - a link wrapped around an image and pointing at the uploaded file is
 *   unwrapped, because it would point at WordPress after the cutover;
 * - links to uploaded documents are recorded, to be copied;
 * - links to other WordPress pages become site-relative, for the redirects;
 * - tags the sanitizer would flatten into loose text are renamed first.
 */
export function transformBody(html: string, context: ResolveContext): BodyResult {
  const images: ImageNeed[] = []
  const files: FileNeed[] = []
  const droppedImages: string[] = []
  const internalLinks: string[] = []
  let captions = 0

  let out = html
    // A gallery is a list of images (6 posts). The sanitizer would keep the
    // list and print bullets, so it becomes a plain run of images.
    .replace(
      /<ul[^>]*class="[^"]*\b(?:wp-block-gallery|blocks-gallery-grid)\b[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi,
      (_whole, inner: string) => inner.replace(/<\/?li\b[^>]*>/gi, "")
    )
    // Unwrap <a href="…/uploads/…jpg"><img …></a>: the image is what matters.
    .replace(
      /<a\s[^>]*href="([^"]+)"[^>]*>\s*(<img\s[^>]*>)\s*<\/a>/gi,
      (whole, href: string, img: string) =>
        isWpUpload(decodeEntities(href)) && fileKind(decodeEntities(href)) === "image-link"
          ? img
          : whole
    )
    .replace(/<img\s[^>]*>/gi, (tag) => {
      const src = attribute(tag, "src") ?? ""
      const alt = (attribute(tag, "alt") ?? "").trim()
      if (isWpUrl(src)) {
        // Not in the export (uploaded outside the media library): the URL
        // without its size suffix is the best guess at the original, and
        // the real run drops the image if that doesn't answer.
        const original = resolveOriginal(tag, src, context)
        const source = original?.url ?? stripSizeSuffix(src).replace("://www.", "://")
        const image = plannedImage(
          source,
          original?.width ?? null,
          original?.height ?? null,
          alt,
          context.postDate
        )
        images.push({ source, hotlinked: false, guessed: !original, image })
        return siteImageTag(image)
      }
      if (/^https?:\/\//i.test(src)) {
        const image = plannedImage(src, null, null, alt, context.postDate)
        images.push({ source: src, hotlinked: true, guessed: false, image })
        return siteImageTag(image)
      }
      droppedImages.push(src)
      return ""
    })
    .replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi, (_whole, inner: string) => {
      const text = inner.replace(/&nbsp;/g, " ").trim()
      if (!text.replace(/<[^>]*>/g, "").trim()) return ""
      captions++
      return `<p>${text}</p>`
    })
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>/gi, (tag, rawHref: string) => {
      const href = decodeEntities(rawHref)
      // An address linked without its scheme resolves as a page path and
      // 404s (four on the contact page). It can only have meant mailto:.
      if (/^[^\s@/:]+@[^\s@/:]+\.[a-z]{2,}$/i.test(href.trim())) {
        return tag.replace(rawHref, `mailto:${escapeAttribute(href.trim())}`)
      }
      if (!isWpUrl(href)) return tag
      if (isWpUpload(href)) {
        const source = href.replace("://www.", "://")
        const kind = fileKind(href)
        const path = kind === "pdf" || kind === "office" ? plannedFilePath(source) : null
        files.push({ source, kind, path })
        return path && context.rewriteFiles
          ? tag.replace(rawHref, escapeAttribute(siteFileUrl(path)))
          : tag
      }
      const url = new URL(href)
      const relative = `${url.pathname}${url.search}${url.hash}`
      internalLinks.push(relative)
      return tag.replace(rawHref, escapeAttribute(relative))
    })
    // The sanitizer drops tags it doesn't know and keeps their text, so a
    // heading or a <b> would turn into unmarked text. Map them first.
    .replace(/<(\/?)h1\b[^>]*>/gi, "<$1h2>")
    .replace(/<(\/?)h[56]\b[^>]*>/gi, "<$1h4>")
    .replace(/<(\/?)b\b[^>]*>/gi, "<$1strong>")
    .replace(/<(\/?)i\b[^>]*>/gi, "<$1em>")
    .replace(/<(\/?)del\b[^>]*>/gi, "<$1s>")

  out = out
    // A figure without its image left behind is just an empty wrapper.
    .replace(/<figure[^>]*>\s*<\/figure>/gi, "")
    // WordPress's spacers: <p>&nbsp;</p>, and <br>s at a paragraph's edges.
    .replace(/(<p[^>]*>)(?:\s|&nbsp;| |<br\s*\/?>)+/gi, "$1")
    .replace(/(?:\s|&nbsp;| |<br\s*\/?>)+(<\/p>)/gi, "$1")
    // A link left with nothing in it (its image gone) is invisible and dead.
    .replace(/<a\s[^>]*>(?:\s|&nbsp;|&#160;)*<\/a>/gi, "")
    .replace(/<p[^>]*><\/p>/gi, "")
    .replace(/\n{3,}/g, "\n\n")

  return { html: out, images, files, droppedImages, internalLinks, captions }
}

/**
 * The excerpt is the article's ingress, printed above the body. WordPress's
 * automatic excerpt is the first paragraph again, so only a hand-written one
 * (3 of 354 posts, from the export) is kept.
 */
export function cleanExcerpt(handWritten: string | null | undefined): string {
  return decodeEntities((handWritten ?? "").replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim()
}

/** `/programandring/` for the redirect map, from the post's permalink. */
export function oldPath(link: string): string {
  return new URL(link).pathname
}
