/**
 * Email addresses on public pages, written as numeric character references
 * (`&#119;&#101;…`). A browser shows and follows them exactly as before, with
 * no JavaScript, but a harvester that greps the HTML for `x@y.z` or `mailto:`
 * finds nothing. Cloudflare's own Email Address Obfuscation can't do it here:
 * it skips HTML a Worker generates, which is every page of this site.
 *
 * Not a lock — a scraper that decodes entities reads them — but it keeps the
 * club's and the members' addresses out of the cheap bulk lists.
 */

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi
const MAILTO = /mailto:/gi

/** Every character as `&#<code point>;`. Safe in text and in attribute values. */
export function encodeEntities(text: string): string {
  return Array.from(text, (char) => `&#${char.codePointAt(0)};`).join("")
}

/**
 * The same HTML with every address and every `mailto:` encoded. For stored,
 * sanitized bodies, which hold no `<script>` or `<style>` where an entity would
 * be read literally.
 */
export function hideEmails(html: string): string {
  return html.replace(MAILTO, encodeEntities).replace(EMAIL, encodeEntities)
}
