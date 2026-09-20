/**
 * Keyset paging for the larm feed, on `(sent_at, id)`, newest first.
 *
 * A near-copy of `keyset.ts` on purpose. That module pages articles on
 * `(published_at, integer id)`; `alerts.id` is a **uuid** and the sort key is
 * `sent_at`, so the cursor grammar and the validation differ in every detail
 * that matters. Generalising the article paging — which ships, and whose
 * filters guard the public article list — to serve one more caller would be
 * churn on tested code for no reader's benefit. Two small, obvious modules
 * beat one parameterised one here.
 *
 * `sent_at` is `not null` and indexed (`alerts_sent_at_idx`). It is also the
 * right sort key rather than `observed_at`: the median gap between them is one
 * minute, but `observed_at` is what a member typed and can be backdated, which
 * would let an old report jump into the middle of a page.
 *
 * As in `keyset.ts`, the timestamp is carried exactly as PostgREST returned
 * it. Parsing it into a Date would drop the microseconds, and two larm sent in
 * the same second would then repeat or vanish across a page boundary.
 */

export type AlertCursor = { sentAt: string; id: string }

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SEPARATOR = "~"

export function encodeAlertCursor(cursor: AlertCursor): string {
  return `${cursor.sentAt}${SEPARATOR}${cursor.id}`
}

/** Null for anything this module didn't write. */
export function decodeAlertCursor(value: string | null | undefined): AlertCursor | null {
  if (!value) return null
  const at = value.lastIndexOf(SEPARATOR)
  if (at === -1) return null
  const sentAt = value.slice(0, at)
  const id = value.slice(at + 1)
  if (!TIMESTAMP.test(sentAt) || !UUID.test(id)) return null
  return { sentAt, id }
}

// Values containing ":" "," "." or "+" must be double-quoted inside a
// PostgREST logic tree; the timestamp has all but the comma. A uuid needs no
// quoting, and both are shape-checked above, so neither can open the filter.
const quoted = (timestamp: string) => `"${timestamp}"`

/** An `.or()` filter for the larm after `cursor` in newest-first order. */
export function olderThan(cursor: AlertCursor): string {
  const at = quoted(cursor.sentAt)
  return `sent_at.lt.${at},and(sent_at.eq.${at},id.lt.${cursor.id})`
}

/** An `.or()` filter for the larm before `cursor` in newest-first order. */
export function newerThan(cursor: AlertCursor): string {
  const at = quoted(cursor.sentAt)
  return `sent_at.gt.${at},and(sent_at.eq.${at},id.gt.${cursor.id})`
}
