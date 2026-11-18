import { describe, expect, it } from "vitest"

import { categoryDescription, hasDescriptionColumn } from "./category-description"

describe("categoryDescription", () => {
  it("reads the column once the migration is applied", () => {
    expect(
      categoryDescription({
        id: 15,
        name: "Mötesplats Ekebacken",
        description: " Tisdagsvandringar. ",
      })
    ).toBe("Tisdagsvandringar.")
  })

  it("reads none before it, or when the value isn't text", () => {
    expect(categoryDescription({ id: 15, name: "Mötesplats Ekebacken" })).toBe("")
    expect(categoryDescription({ id: 15, description: null })).toBe("")
  })
})

describe("hasDescriptionColumn", () => {
  it("tells the two sides of the migration apart", () => {
    expect(hasDescriptionColumn([{ id: 1, name: "Referat", description: "" }])).toBe(true)
    expect(hasDescriptionColumn([{ id: 1, name: "Referat" }])).toBe(false)
    expect(hasDescriptionColumn([])).toBe(false)
  })
})
