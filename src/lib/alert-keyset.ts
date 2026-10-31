/**
 * Keyset paging for the larm feed, on `(observed_at, id)`, newest first.
 *
 * A near-copy of `keyset.ts` on purpose. That module pages articles on
 * `(published_at, integer id)`; `alerts.id` is a **uuid** and the sort key is
 * `observed_at`, so the cursor grammar and the validation differ in every detail
 * that matters. Generalising the article paging — which ships, and whose
 * filters guard the public article list — to serve one more caller would be
 * churn on tested code for no reader's benefit. Two small, obvious modules
 * beat one parameterised one here.
 *
 * The feed prints when the bird was seen, so it sorts on that too. On `sent_at`
 * a report sent late put 08:30 between 14:33 and 13:30, and the log read as
 * broken (changed 2026-10-31). A backdated report now lands where it belongs,
 * which can shift an open page by a row; of the first 323 larm none had a null
 * `observed_at` and two were over a day late. The column has no index and
 * `alerts` isn't ours to add one to; a few hundred rows don't need it.
 *
 * As in `keyset.ts`, the timestamp is carried exactly as PostgREST returned
 * it. Parsing it into a Date would drop the microseconds, and two larm seen in
 * the same second would then repeat or vanish across a page boundary.
 */

export type AlertCursor = { observedAt: string; id: string }

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SEPARATOR = "~"

export function encodeAlertCursor(cursor: AlertCursor): string {
  return `${cursor.observedAt}${SEPARATOR}${cursor.id}`
}

/** Null for anything this module didn't write. */
export function decodeAlertCursor(value: string | null | undefined): AlertCursor | null {
  if (!value) return null
  const at = value.lastIndexOf(SEPARATOR)
  if (at === -1) return null
  const observedAt = value.slice(0, at)
  const id = value.slice(at + 1)
  if (!TIMESTAMP.test(observedAt) || !UUID.test(id)) return null
  return { observedAt, id }
}

// Values containing ":" "," "." or "+" must be double-quoted inside a
// PostgREST logic tree; the timestamp has all but the comma. A uuid needs no
// quoting, and both are shape-checked above, so neither can open the filter.
const quoted = (timestamp: string) => `"${timestamp}"`

/** An `.or()` filter for the larm after `cursor` in newest-first order. */
export function olderThan(cursor: AlertCursor): string {
  const at = quoted(cursor.observedAt)
  return `observed_at.lt.${at},and(observed_at.eq.${at},id.lt.${cursor.id})`
}

/** An `.or()` filter for the larm before `cursor` in newest-first order. */
export function newerThan(cursor: AlertCursor): string {
  const at = quoted(cursor.observedAt)
  return `observed_at.gt.${at},and(observed_at.eq.${at},id.gt.${cursor.id})`
}
