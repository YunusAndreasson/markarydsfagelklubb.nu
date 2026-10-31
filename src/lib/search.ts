/**
 * The search box's input, made safe for a PostgREST filter (docs/design.md,
 * "Sök"). The query comes straight from a URL and lands inside a logic tree, so
 * it is length-limited here and quoted below, never interpolated bare.
 */

const MAX_QUERY = 100

/** Trimmed, one space between words, at most 100 characters; "" for nothing to search. */
export function normaliseSearchQuery(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY).trim()
}

// Inside PostgREST's double quotes only `"` and `\` need escaping. `*` is ilike's
// wildcard, and would let a query widen itself, so it goes too.
const quoted = (value: string) => `"${value.replace(/[\\"]/g, "\\$&")}"`

/**
 * An `.or()` filter: the Swedish full-text index, or the query anywhere in the
 * title. The index stems whole words, so "uggla" finds "ugglor" but not
 * "sparvuggla"; the title match catches what a compound word hides.
 */
export function searchFilter(query: string): string {
  const literal = query.replaceAll("*", "")
  return `search.wfts(swedish).${quoted(query)},title.ilike.${quoted(`*${literal}*`)}`
}

/** The lokaler whose name holds the query, ignoring case. */
export function matchesName(name: string, query: string): boolean {
  return name.toLocaleLowerCase("sv").includes(query.toLocaleLowerCase("sv"))
}
