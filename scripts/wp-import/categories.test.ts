import { describe, expect, it } from "vitest"
import { CATEGORY_MAP, pickCategory, SITE_CATEGORIES } from "./categories"

describe("pickCategory", () => {
  it("maps a sub-category onto its site category", () => {
    expect(pickCategory(["smalandsrallyt"])).toEqual({ kind: "category", slug: "tavlingar" })
  })

  it("lets the most specific category win", () => {
    // Referat outranks Föreningsaktuellt; Tävlingar outranks everything.
    expect(pickCategory(["inventering", "upprop"])).toEqual({ kind: "category", slug: "referat" })
    expect(pickCategory(["referat", "smalandsrallyt"])).toEqual({
      kind: "category",
      slug: "tavlingar",
    })
    expect(pickCategory(["foreningsaktuellt", "program-2026"])).toEqual({
      kind: "category",
      slug: "program",
    })
  })

  it("leaves Okategoriserade without a category", () => {
    expect(pickCategory(["okategoriserade"])).toEqual({ kind: "none" })
    expect(pickCategory([])).toEqual({ kind: "none" })
  })

  it("reports a category added since the sign-off instead of guessing", () => {
    expect(pickCategory(["referat", "ny-kategori"])).toEqual({
      kind: "unmapped",
      wpSlugs: ["ny-kategori"],
    })
  })

  it("maps onto the six site categories only", () => {
    const site = new Set(SITE_CATEGORIES.map((category) => category.slug))
    expect(SITE_CATEGORIES).toHaveLength(6)
    for (const target of Object.values(CATEGORY_MAP)) expect(site.has(target)).toBe(true)
    // 46 WordPress categories, less Okategoriserade.
    expect(Object.keys(CATEGORY_MAP)).toHaveLength(45)
  })
})
