import { decodeEntities } from "./transform"

/**
 * Tidying the club's imported writing (docs/wp-import.md, "Tidying",
 * 2026-10-24). Used by the import's body transform and, once, by
 * `tidy-stored.ts` for the articles already in the database. Pure: no I/O.
 *
 * WordPress's classic editor made a line break where the club pressed Enter,
 * so most posts are paragraphs of `<br>`-separated lines. Three kinds:
 *
 * - **a hard wrap** in the middle of a sentence ("behövde<br>vi inte vänta"),
 *   pasted from an e-mail: joined with a space;
 * - **a bullet** typed as "•" at the start of a line: the lines become a list;
 * - **a sentence per line**: each long line becomes its own paragraph, so the
 *   site's paragraph spacing applies. A run of short lines (a sign-off, a
 *   contact block, a list of species) stays one paragraph of lines.
 *
 * Only top-level paragraphs are touched; a break inside a caption, a list
 * item, a table cell or a quote is the writer's own.
 */

/** A line this long or longer is prose; shorter ones are lines of a block. */
const SHORT_LINE = 50
/** A line that ends a sentence (or a label: "Ledare:"). */
const SENTENCE_END = /[.!?:…)"”»]$/u
/** A line that can't end there: a sentence never ends on a comma. */
const DANGLING_END = /[,;–-]$/
/** Small words a sentence doesn't end on, so a break after one is a wrap. */
const WRAP_WORDS = new Set([
  "av",
  "att",
  "de",
  "den",
  "det",
  "eller",
  "en",
  "ett",
  "för",
  "från",
  "i",
  "med",
  "men",
  "och",
  "om",
  "på",
  "som",
  "till",
  "under",
  "vid",
  "över",
])
const ADDRESS_LINE = /^(?:\S+@\S+\.\S+|https?:\/\/|www\.)/i
const BULLET = /^(?:\s|&nbsp;|&#160;)*[•·●]\s*/
const BOLD_LINE = /^<strong>[\s\S]*<\/strong>$/
const BREAK = /^<br\s*\/?>$/i
const VOID_TAG = /^<(?:br|img|hr)\b/i

/** The visible text of an HTML fragment, whitespace collapsed. */
export function plainText(fragment: string): string {
  const text = fragment.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "")
  return decodeEntities(text).replace(/\s+/g, " ").trim()
}

/** The paragraph's lines, split at breaks that aren't inside a bold or a link. */
function topLevelLines(inner: string): string[] {
  const lines: string[] = []
  let line = ""
  let depth = 0
  for (const token of inner.match(/<[^>]*>|[^<]+/g) ?? []) {
    if (BREAK.test(token) && depth === 0) {
      lines.push(line)
      line = ""
      continue
    }
    if (token.startsWith("</")) depth = Math.max(0, depth - 1)
    else if (token.startsWith("<") && !VOID_TAG.test(token) && !token.endsWith("/>")) depth++
    line += token
  }
  lines.push(line)
  return lines.map((each) => each.trim()).filter((each) => plainText(each) !== "")
}

/** Whether `next` carries on the sentence `previous` broke off. */
function continues(previous: string, next: string): boolean {
  if (BULLET.test(next) || BOLD_LINE.test(previous)) return false
  const before = plainText(previous)
  const after = plainText(next)
  // An address on a line of its own is a contact block's next line.
  if (ADDRESS_LINE.test(after)) return false
  if (SENTENCE_END.test(before)) return false
  const lastWord = before.split(" ").at(-1)?.toLocaleLowerCase("sv") ?? ""
  if (WRAP_WORDS.has(lastWord)) return true
  // After a comma, a capital starts a new line of a list ("Tjäder, 5 obsar,"
  // then "Ringtrast. …"); a lowercase word or a number carries on.
  if (DANGLING_END.test(before)) return /^[\p{Ll}\d]/u.test(after)
  // A short line followed by a lowercase one is a list of names, not a wrap.
  return /^\p{Ll}/u.test(after) && before.length >= 30
}

function tidyParagraph(inner: string): string {
  if (!/<br\s*\/?>/i.test(inner) || inner.includes("<img")) return `<p>${inner}</p>`

  const lines: string[] = []
  for (const line of topLevelLines(inner)) {
    const previous = lines.at(-1)
    if (previous !== undefined && continues(previous, line)) {
      lines[lines.length - 1] = `${previous} ${line}`
    } else {
      lines.push(line)
    }
  }

  const blocks: string[] = []
  let shortLines: string[] = []
  let bullets: string[] = []
  const endShortLines = () => {
    if (shortLines.length > 0) blocks.push(`<p>${shortLines.join("<br />")}</p>`)
    shortLines = []
  }
  const endBullets = () => {
    if (bullets.length > 0) {
      blocks.push(`<ul>${bullets.map((item) => `<li><p>${item}</p></li>`).join("")}</ul>`)
    }
    bullets = []
  }
  for (const line of lines) {
    if (BULLET.test(line)) {
      endShortLines()
      bullets.push(line.replace(BULLET, ""))
    } else if (plainText(line).length < SHORT_LINE) {
      endBullets()
      shortLines.push(line)
    } else {
      endBullets()
      endShortLines()
      blocks.push(`<p>${line}</p>`)
    }
  }
  endBullets()
  endShortLines()
  return blocks.join("")
}

const CONTAINER_OR_PARAGRAPH =
  /<(\/?)(?:ul|ol|li|table|td|th|blockquote|figure)\b[^>]*>|<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi

/** Every top-level paragraph's line breaks, sorted out as described above. */
export function tidyLineBreaks(html: string): string {
  let depth = 0
  return html.replace(
    CONTAINER_OR_PARAGRAPH,
    (token, closing: string | undefined, inner: string | undefined) => {
      if (inner === undefined) {
        depth = Math.max(0, depth + (closing ? -1 : 1))
        return token
      }
      return depth === 0 ? tidyParagraph(inner) : token
    }
  )
}

/**
 * The import used to turn a `<figcaption>` into the paragraph after its photo.
 * This puts such a paragraph back into a figure with its photo, but only when
 * its text is one of the post's WordPress captions, so an ordinary paragraph
 * after a photo stays a paragraph. Each caption is used once.
 */
export function captionStoredPhotos(
  html: string,
  captions: readonly string[]
): { html: string; captioned: number } {
  const wanted = captions.map(plainText).filter((text) => text !== "")
  let captioned = 0
  const out = html.replace(
    /(<img\s[^>]*>)\s*<p>([\s\S]*?)<\/p>/g,
    (whole, img: string, inner: string) => {
      const index = wanted.indexOf(plainText(inner))
      if (index === -1) return whole
      wanted.splice(index, 1)
      captioned++
      return `<figure>${img}<figcaption>${inner.trim()}</figcaption></figure>`
    }
  )
  return { html: out, captioned }
}
