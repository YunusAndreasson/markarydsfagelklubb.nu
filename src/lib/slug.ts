/**
 * URL slugs for articles and pages. Same shape as the database checks:
 * lowercase a–z, digits, single hyphens between them.
 */

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Long enough for any real title, short enough to type. */
export const SLUG_MAX_LENGTH = 96

/**
 * First path segments that belong to the site itself. A top-level page with
 * one of these slugs would be shadowed by, or shadow, a route.
 */
export const RESERVED_TOP_LEVEL_SLUGS: ReadonlySet<string> = new Set([
  "404",
  "admin",
  "api",
  "artiklar",
  "kalender",
  "larm",
  "lokaler",
])

/** `/artiklar/kategori/<slug>` lists a category, so no article may be called that. */
export const RESERVED_ARTICLE_SLUGS: ReadonlySet<string> = new Set(["kategori"])

// Letters NFKD does not split into a base letter plus a mark.
const SPELLED_OUT: Record<string, string> = { æ: "ae", ø: "o", ß: "ss", đ: "d", ł: "l" }

/**
 * A slug from a title, the way WordPress makes them: å and ä become a, ö
 * becomes o, anything else that isn't a letter or digit becomes a hyphen.
 * Returns "" when nothing usable is left.
 */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[æøßđł]/g, (letter) => SPELLED_OUT[letter] ?? letter)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (slug.length <= SLUG_MAX_LENGTH) return slug
  // Cut at a word boundary when there is one.
  const cut = slug.slice(0, SLUG_MAX_LENGTH)
  const lastHyphen = cut.lastIndexOf("-")
  return (lastHyphen > 0 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/, "")
}

export function isValidSlug(value: string): boolean {
  return value.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(value)
}
