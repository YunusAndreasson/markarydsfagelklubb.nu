/**
 * Keyset paging for article lists. Supabase caps a response at 1 000 rows and
 * offsets get slower and shift under inserts, so the list pages by its sort
 * key instead: (published_at, id), newest first.
 *
 * The cursor carries the timestamp exactly as PostgREST returned it. Parsing
 * it into a JS Date would drop the microseconds, and the next page would then
 * repeat or skip the articles published in the same second.
 */

export type Cursor = { publishedAt: string; id: number }

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/
const SEPARATOR = "~"

export function encodeCursor(cursor: Cursor): string {
  return `${cursor.publishedAt}${SEPARATOR}${cursor.id}`
}

/** Null for anything that isn't a cursor this module wrote. */
export function decodeCursor(value: string | null | undefined): Cursor | null {
  if (!value) return null
  const at = value.lastIndexOf(SEPARATOR)
  if (at === -1) return null
  const publishedAt = value.slice(0, at)
  const idText = value.slice(at + 1)
  if (!TIMESTAMP.test(publishedAt) || !/^[1-9]\d{0,15}$/.test(idText)) return null
  return { publishedAt, id: Number(idText) }
}

// Values with ":" "," "." or "+" must be double-quoted inside a PostgREST
// logic tree; the timestamp has all but the comma.
const quoted = (timestamp: string) => `"${timestamp}"`

/** An `.or()` filter for the rows after `cursor` in newest-first order. */
export function olderThan(cursor: Cursor): string {
  const at = quoted(cursor.publishedAt)
  return `published_at.lt.${at},and(published_at.eq.${at},id.lt.${cursor.id})`
}

/** An `.or()` filter for the rows before `cursor` in newest-first order. */
export function newerThan(cursor: Cursor): string {
  const at = quoted(cursor.publishedAt)
  return `published_at.gt.${at},and(published_at.eq.${at},id.gt.${cursor.id})`
}
