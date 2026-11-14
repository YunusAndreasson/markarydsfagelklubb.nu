/**
 * The club's larmlista "prefix": how rare a bird is, 0 (rarest) to 5 (most
 * common). Mirrored from the app (`../mafk-mobie/src/lib/rarity.ts` and its
 * `sv.ts` copy) so the same bird reads the same in both places.
 *
 * `species.rarity` is null for 35 of the 238 larm — species that were never
 * given a prefix. Those fall back to 5, the same "safe default" the app uses:
 * an unlisted bird is treated as ordinary rather than announced as a rarity.
 *
 * Since 2026-11-14 the site shows the **number**, as the app does: members
 * asked for it, and read the club's prefix at a glance. Every larm carries a
 * chip (`RarityChip.astro`, the app's colours in global.css's `--rarity-N`
 * tokens), and the word still prints beside it from "Ovanlig" up, where it
 * explains the number to a newcomer. Text colour stays on {@link isRare}.
 */

export type RarityLevel = 0 | 1 | 2 | 3 | 4 | 5

/** An unlisted species is ordinary, not a rarity (the app's fallback). */
export const DEFAULT_RARITY: RarityLevel = 5

const LABELS = [
  "Mycket sällsynt",
  "Sällsynt",
  "Ovanlig",
  "Mindre allmän",
  "Ganska allmän",
  "Allmän",
] as const satisfies Record<RarityLevel, string>

/** At or below this level, the site gives a larm colour. */
export const RARE_THRESHOLD = 1

/**
 * At or below this level, the feed prints the word at all.
 *
 * "Allmän" on a magpie tells a reader nothing — and 191 of the first 238 larm
 * were level 4 or 5. Printing the word only from "Ovanlig" up makes its
 * presence the information.
 */
export const RARITY_WORTH_SAYING = 2

export function rarityLevel(rarity: number | null | undefined): RarityLevel {
  if (typeof rarity !== "number" || !Number.isInteger(rarity)) return DEFAULT_RARITY
  if (rarity < 0 || rarity > 5) return DEFAULT_RARITY
  return rarity as RarityLevel
}

export function rarityLabel(level: RarityLevel): string {
  return LABELS[level]
}

/** True for the two levels worth interrupting a reader for. */
export function isRare(level: RarityLevel): boolean {
  return level <= RARE_THRESHOLD
}
