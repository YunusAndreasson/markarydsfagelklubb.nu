import { hideEmails } from "./email-hiding"
import { isSiteMediaUrl } from "./media"
import { formatPhone } from "./phone"
import { attributesOf, widestCandidate } from "./teaser"

/**
 * Two or more photos in a row, wrapped as a contact sheet (`.content-gallery`).
 * Done at render, on HTML the sanitizer has already passed: the stored body and
 * the editor keep their plain column of figures. A figure never nests, so the
 * lazy match can't run past its own end.
 */
const PHOTO = String.raw`<figure\b[^>]*>[\s\S]*?<\/figure>|<a class="photo"[^>]*>\s*<img\b[^>]*>\s*<\/a>|<img\b[^>]*>`
const PHOTO_RUN = new RegExp(String.raw`(?:(?:${PHOTO})\s*){2,}`, "g")

/**
 * A photo's width over its height, from its `<img>`'s own attributes, held to
 * 1:2…5:2 so a panorama beside a portrait can't squeeze it to a sliver. 3:2,
 * the members' usual camera, when the image doesn't say.
 */
export function photoRatio(photo: string): number {
  const img = photo.match(/<img\b[^>]*>/i)?.[0] ?? ""
  const attributes = attributesOf(img)
  const width = Number(attributes.get("width"))
  const height = Number(attributes.get("height"))
  const ratio = width > 0 && height > 0 ? width / height : 1.5
  return Math.round(Math.min(2.5, Math.max(0.5, ratio)) * 1000) / 1000
}

/**
 * The run laid out two to a row (docs/design.md, "Kontaktark"). Each cell
 * carries its photo's ratio, and the row shares its width out by it, so the two
 * photos stand the same height and their captions start on one line, with
 * neither photo cropped.
 */
export function withGalleries(html: string): string {
  return html.replace(PHOTO_RUN, (run) => {
    const photos = run.match(new RegExp(PHOTO, "g")) ?? []
    const rows: string[] = []
    for (let i = 0; i < photos.length; i += 2) {
      const cells = photos
        .slice(i, i + 2)
        .map(
          (photo) =>
            `<div class="gallery-cell" style="--ratio: ${photoRatio(photo)}">${photo}</div>`
        )
      rows.push(`<div class="gallery-row">${cells.join("")}</div>`)
    }
    return `<div class="content-gallery">${rows.join("")}</div>`
  })
}

// An area code of three or four digits, then the rest in any of the club's styles:
// 0701-74 06 05, 0701 – 740605, 070-1740606. Bankgiro and Swish numbers don't start
// with 0, and the digit count below rules out the rest.
const PHONE = /(?<![\d-])0\d{2,3}[\s\u00a0]*[-–—]?[\s\u00a0]*\d[\d\s\u00a0-]{3,10}\d(?!\d)/g

/**
 * Phone numbers as `tel:` links, at render, like the galleries: the club's sign-ups run
 * on them, and thirteen years of posts hold them as plain text, in every style; the
 * link's words are the number as `formatPhone` writes it. Only text is touched,
 * never a tag's attributes or a link's own words. The href is digits only.
 */
export function linkPhones(html: string): string {
  let insideLink = 0
  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith("<")) {
        if (/^<a\b/i.test(part)) insideLink++
        else if (/^<\/a>/i.test(part)) insideLink = Math.max(0, insideLink - 1)
        return part
      }
      if (insideLink > 0) return part
      return part.replace(PHONE, (match) => {
        const digits = match.replace(/\D/g, "")
        return digits.length === 9 || digits.length === 10
          ? `<a href="tel:${digits}">${formatPhone(match)}</a>`
          : match
      })
    })
    .join("")
}

const escapeAttribute = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;")

/** The srcset candidate with the widest `w` descriptor, or null. */
function widestUrl(srcset: string): string | null {
  let best: { url: string; width: number } | null = null
  for (const candidate of srcset.split(",")) {
    const [url, descriptor] = candidate.trim().split(/\s+/)
    const width = Number(descriptor?.match(/^(\d+)w$/)?.[1] ?? 0)
    if (url && width > (best?.width ?? 0)) best = { url, width }
  }
  return best?.url ?? null
}

/** Where a photo opens, and at what size, when it is one of the site's own. */
export type PhotoLink = { href: string; width?: number; height?: number }

/**
 * A photo's largest file, sized for the viewer: the widest srcset candidate,
 * with the height scaled from the image's own width and height. Null for an
 * image that isn't the site's.
 */
export function photoLink(
  src: string,
  srcset: string,
  width: number,
  height: number
): PhotoLink | null {
  if (!isSiteMediaUrl(src)) return null
  const href = widestUrl(srcset) ?? src
  if (!isSiteMediaUrl(href)) return null
  const fullWidth = widestCandidate(srcset) || width
  if (width > 0 && height > 0 && fullWidth > 0) {
    return { href, width: fullWidth, height: Math.round((height * fullWidth) / width) }
  }
  return { href }
}

/**
 * Every photo as a link to its largest file (docs/design.md, "Lupen"), at render,
 * like the galleries. Without JS the link opens the photo itself, so every photo
 * can be enlarged by tap or keyboard; with JS, `PhotoViewer.astro` opens it in
 * the viewer instead, at the size given here. A photo that already sits in a
 * link keeps it, and only the site's own images are touched.
 */
export function linkPhotos(html: string): string {
  let insideLink = 0
  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (/^<a\b/i.test(part)) insideLink++
      else if (/^<\/a>/i.test(part)) insideLink = Math.max(0, insideLink - 1)
      if (insideLink > 0 || !/^<img\s/i.test(part)) return part

      const attributes = attributesOf(part)
      const link = photoLink(
        attributes.get("src") ?? "",
        attributes.get("srcset") ?? "",
        Number(attributes.get("width")) || 0,
        Number(attributes.get("height")) || 0
      )
      if (!link) return part
      const size = link.width
        ? ` data-pswp-width="${link.width}" data-pswp-height="${link.height}"`
        : ""
      return `<a class="photo" href="${escapeAttribute(link.href)}"${size}>${part}</a>`
    })
    .join("")
}

/** A stored body, ready for the page. Addresses are hidden from harvesters last. */
export const renderBody = (html: string) => hideEmails(withGalleries(linkPhotos(linkPhones(html))))
