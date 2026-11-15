/**
 * The larmlista numbers on /admin/arter: one form for every species, so the
 * admin can go down the list and save once. Only the rows whose number
 * changed are written, each its own update of `species.rarity` with the
 * admin's session (migration 20261115110122: admins may update that column
 * and nothing else; species_rarity_check keeps it to 0–5 or empty).
 */

export type SpeciesRarityRow = { id: number; rarity: number | null }

export type RarityChange = { id: number; rarity: number | null }

/** The form field for one species. */
export const rarityField = (id: number) => `r-${id}`

/** "0"–"5" is that number, "" is no number (unlisted); anything else is no answer. */
function parseValue(raw: FormDataEntryValue | null): number | null | undefined {
  if (raw === null) return undefined
  const text = String(raw).trim()
  if (text === "") return null
  return /^[0-5]$/.test(text) ? Number(text) : undefined
}

/**
 * The species whose submitted number differs from what the database holds.
 * A missing or malformed field leaves its species alone, so a tampered or
 * half-sent form can only change what it states clearly.
 */
export function rarityChanges(
  form: FormData,
  current: readonly SpeciesRarityRow[]
): RarityChange[] {
  return current.flatMap((row) => {
    const value = parseValue(form.get(rarityField(row.id)))
    if (value === undefined || value === row.rarity) return []
    return [{ id: row.id, rarity: value }]
  })
}
