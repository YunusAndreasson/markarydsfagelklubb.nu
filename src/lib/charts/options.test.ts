import { describe, expect, it } from "vitest"
import { phenologyCells } from "./options"

describe("phenologyCells", () => {
  it("scales each species to its own busiest week", () => {
    const cells = phenologyCells({
      species: [
        { name: "Talgoxe", weeks: [400, 200, 0] },
        { name: "Gök", weeks: [0, 3, 12] },
      ],
    })
    const top = (row: number) => Math.max(...cells.filter((c) => c[1] === row).map((c) => c[2]))
    expect(top(0)).toBe(1)
    expect(top(1)).toBe(1)
    // Empty weeks get no cell; the count stays for the tooltip.
    expect(cells).toHaveLength(4)
    expect(cells).toContainEqual([1, 1, 0.25, 3])
  })
})
