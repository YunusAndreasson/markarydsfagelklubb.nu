/**
 * The club's larmlista "prefix": how rare a bird is, 0 (rarest) to 5 (most
 * common). Mirrored from the app (`../mafk-mobie/src/lib/rarity.ts` and its
 * `sv.ts` copy) so the same bird reads the same in both places.
 *
 * `species.rarity` is null for 35 of the 238 larm — species that were never
 * given a prefix. Those fall back to 5, the same "safe default" the app uses:
 * an unlisted bird is treated as ordinary rather than announced as a rarity.
 *
 * The site shows the **word**, not the number. A coloured digit is the app's
 * idiom, where it sits in a dense feed; here, 191 of the 238 larm are level
 * 4–5 and none has ever been 0 or 1, so a badge on every row would be noise
 * that never means anything. Colour is spent only on {@link isRare} — which
 * keeps docs/design.md's rule that colour marks action and status, and leaves
 * the page quiet until something genuinely rare turns up.
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
