/**
 * Site images (docs/roadmap.md, D3): one `media` row per upload, and up to
 * three pre-generated widths per image in the public `site-media` bucket at
 * `<storage_prefix>/<width>.<ext>`. Nothing resizes at request time.
 */

/**
 * The Supabase project's origin, which serves the public bucket. Hard-coded
 * because the CSP in public/_headers has to name it too; a test checks it
 * against `SUPABASE_URL` in wrangler.jsonc.
 */
export const SUPABASE_ORIGIN = "https://zgnmajovyqibgxlcomvb.supabase.co"

export const SITE_MEDIA_BUCKET = "site-media"

/** Every site image URL starts with this; the sanitizer allows nothing else. */
export const SITE_MEDIA_PUBLIC_PREFIX = `${SUPABASE_ORIGIN}/storage/v1/object/public/${SITE_MEDIA_BUCKET}/`

/** The widths generated at upload. Smaller originals are never upscaled. */
export const IMAGE_WIDTHS = [480, 960, 1600] as const

/** `sizes` for an image in the reading column (38rem, full width below it). */
export const COLUMN_SIZES = "(min-width: 40rem) 38rem, 100vw"

export type MediaFormat = "webp" | "jpeg"

const EXTENSION: Record<MediaFormat, string> = { webp: "webp", jpeg: "jpg" }

export type MediaImage = {
  storage_prefix: string
  format: MediaFormat
  widths: number[]
  width: number
  height: number
  alt: string
}

/** The widths to generate for an original `originalWidth` pixels wide. */
export function planImageWidths(originalWidth: number): number[] {
  const width = Math.floor(originalWidth)
  if (!Number.isFinite(width) || width < 1) return []
  const widths: number[] = IMAGE_WIDTHS.filter((target) => target <= width)
  const largest = IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1] ?? width
  // A smaller original is kept at its own width rather than dropped or blown up.
  if (width < largest && !widths.includes(width)) widths.push(width)
  return widths.slice(-IMAGE_WIDTHS.length)
}

/** `2026/09/<uuid>`: where a new upload's variants go. Month in UTC. */
export function newStoragePrefix(now: Date, uuid: string): string {
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  return `${year}/${month}/${uuid}`
}

/** The object path inside the bucket. */
export function mediaObjectPath(prefix: string, width: number, format: MediaFormat): string {
  return `${prefix}/${width}.${EXTENSION[format]}`
}

export function mediaUrl(prefix: string, width: number, format: MediaFormat): string {
  return `${SITE_MEDIA_PUBLIC_PREFIX}${mediaObjectPath(prefix, width, format)}`
}

function sortedWidths(image: MediaImage): number[] {
  return [...image.widths].sort((a, b) => a - b)
}

export function mediaSrcset(image: MediaImage): string {
  return sortedWidths(image)
    .map((width) => `${mediaUrl(image.storage_prefix, width, image.format)} ${width}w`)
    .join(", ")
}

/**
 * The plain `src`: the variant closest to 960 px, so a browser that ignores
 * `srcset` still gets a sensible file.
 */
export function mediaFallbackUrl(image: MediaImage): string {
  const widths = sortedWidths(image)
  const fallback = widths.find((width) => width >= 960) ?? widths[widths.length - 1] ?? image.width
  return mediaUrl(image.storage_prefix, fallback, image.format)
}

/** True for a URL inside the public site-media bucket, and nothing that merely resembles one. */
export function isSiteMediaUrl(value: string): boolean {
  if (!value.startsWith(SITE_MEDIA_PUBLIC_PREFIX)) return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  // URL parsing resolves "..", so compare the normalised path too.
  return url.origin === SUPABASE_ORIGIN && url.href.startsWith(SITE_MEDIA_PUBLIC_PREFIX)
}
