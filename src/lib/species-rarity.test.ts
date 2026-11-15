import { describe, expect, it } from "vitest"
import { rarityChanges, rarityField } from "./species-rarity"

const current = [
  { id: 44, rarity: 4 },
  { id: 178, rarity: 1 },
  { id: 9, rarity: null },
]

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

describe("rarityChanges", () => {
  it("writes only the species whose number changed", () => {
    const sent = form({ [rarityField(44)]: "3", [rarityField(178)]: "1", [rarityField(9)]: "" })
    expect(rarityChanges(sent, current)).toEqual([{ id: 44, rarity: 3 }])
  })

  it("can give an unlisted species a number, and take one away", () => {
    const sent = form({ [rarityField(9)]: "0", [rarityField(178)]: "" })
    expect(rarityChanges(sent, current)).toEqual([
      { id: 178, rarity: null },
      { id: 9, rarity: 0 },
    ])
  })

  it("leaves a species alone when its field is missing or not 0–5", () => {
    const sent = form({ [rarityField(44)]: "6", [rarityField(178)]: "1; drop table", "r-999": "2" })
    expect(rarityChanges(sent, current)).toEqual([])
  })
})
