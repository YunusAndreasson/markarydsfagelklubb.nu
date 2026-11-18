/**
 * A category's description (its page's ingress), read from a whole row.
 *
 * `categories.description` comes with migration 20261118203552. The site reads
 * categories with `select("*")` so that it works on both sides of that
 * migration: a named column that doesn't exist yet fails the whole read, and
 * with no categories every category page would 404. Before the migration the
 * row simply has no description, which reads as none.
 */
export function categoryDescription(row: object): string {
  const value = (row as { description?: unknown }).description
  return typeof value === "string" ? value.trim() : ""
}

/** Whether the rows read have the column yet, so the admin can offer the field. */
export function hasDescriptionColumn(rows: readonly object[]): boolean {
  return rows.some((row) => "description" in row)
}
