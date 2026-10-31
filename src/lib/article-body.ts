/**
 * Two or more photos in a row, wrapped as a contact sheet (`.content-gallery`).
 * Done at render, on HTML the sanitizer has already passed: the stored body and
 * the editor keep their plain column of figures. A figure never nests, so the
 * lazy match can't run past its own end.
 */
const PHOTO_RUN = /(?:(?:<figure\b[^>]*>[\s\S]*?<\/figure>|<img\b[^>]*>)\s*){2,}/g

export function withGalleries(html: string): string {
  return html.replace(PHOTO_RUN, (run) => `<div class="content-gallery">${run}</div>`)
}

// An area code of three or four digits, then the rest in any of the club's styles:
// 070-174 06 05, 070-174 06 05, 070-174 06 06. Bankgiro and Swish numbers don't start
// with 0, and the digit count below rules out the rest.
const PHONE = /(?<![\d-])0\d{2,3}[\s\u00a0]*[-–—]?[\s\u00a0]*\d[\d\s\u00a0-]{3,10}\d(?!\d)/g

/**
 * Phone numbers as `tel:` links, at render, like the galleries: the club's sign-ups run
 * on them, and thirteen years of posts hold them as plain text. Only text is touched,
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
          ? `<a href="tel:${digits}">${match}</a>`
          : match
      })
    })
    .join("")
}

/** A stored body, ready for the page. */
export const renderBody = (html: string) => withGalleries(linkPhones(html))
