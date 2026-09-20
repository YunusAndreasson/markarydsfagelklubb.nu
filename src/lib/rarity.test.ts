import { describe, expect, it } from "vitest"

import { DEFAULT_RARITY, isRare, type RarityLevel, rarityLabel, rarityLevel } from "./rarity"

describe("rarityLevel", () => {
  it("passes every level of the club's scale through unchanged", () => {
    for (const level of [0, 1, 2, 3, 4, 5]) {
      expect(rarityLevel(level), String(level)).toBe(level)
    }
  })

  it("treats an unlisted species as ordinary, never as a rarity", () => {
    // 35 of the 238 live larm are for species with no prefix. Guessing "rare"
    // would put a red mark on a magpie.
    for (const missing of [null, undefined]) {
      expect(rarityLevel(missing), String(missing)).toBe(DEFAULT_RARITY)
    }
    expect(isRare(rarityLevel(null))).toBe(false)
  })

  it("refuses anything outside the scale rather than indexing past the labels", () => {
    for (const bad of [-1, 6, 42, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(rarityLevel(bad), String(bad)).toBe(DEFAULT_RARITY)
    }
  })
})

describe("rarityLabel", () => {
  it("uses the app's own words, so a bird reads the same in both places", () => {
    expect(rarityLabel(0)).toBe("Mycket sällsynt")
    expect(rarityLabel(3)).toBe("Mindre allmän")
    expect(rarityLabel(5)).toBe("Allmän")
  })

  it("has a word for every level", () => {
    for (const level of [0, 1, 2, 3, 4, 5] as RarityLevel[]) {
      expect(rarityLabel(level), String(level)).toMatch(/\S/)
    }
  })
})

describe("isRare", () => {
  it("marks only the two levels worth interrupting a reader for", () => {
    expect([0, 1, 2, 3, 4, 5].map((level) => isRare(level as RarityLevel))).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ])
  })
})
