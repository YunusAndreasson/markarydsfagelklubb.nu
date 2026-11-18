import { describe, expect, it } from "vitest"
import {
  CATEGORY_FIXES,
  CATEGORY_MAP,
  categoryFor,
  pickCategory,
  SITE_CATEGORIES,
} from "./categories"

describe("pickCategory", () => {
  it("maps a sub-category onto its site category", () => {
    expect(pickCategory(["smalandsrallyt"])).toEqual({ kind: "category", slug: "tavlingar" })
  })

  it("lets the most specific category win", () => {
    // Referat outranks Föreningsaktuellt; Utmaningar (tavlingar) outranks everything.
    expect(pickCategory(["inventering", "upprop"])).toEqual({ kind: "category", slug: "referat" })
    expect(pickCategory(["referat", "smalandsrallyt"])).toEqual({
      kind: "category",
      slug: "tavlingar",
    })
    // Program is gone (2026-11-18): its announcements are excursions.
    expect(pickCategory(["foreningsaktuellt", "program-2026"])).toEqual({
      kind: "category",
      slug: "exkursioner",
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

  it("maps onto the five site categories only", () => {
    const site = new Set(SITE_CATEGORIES.map((category) => category.slug))
    expect(SITE_CATEGORIES).toHaveLength(5)
    expect(site.has("program")).toBe(false)
    for (const target of Object.values(CATEGORY_MAP)) expect(site.has(target)).toBe(true)
    for (const target of Object.values(CATEGORY_FIXES)) expect(site.has(target)).toBe(true)
    // 47 WordPress categories, less Okategoriserade. Konstutställning came in 2026-11.
    expect(Object.keys(CATEGORY_MAP)).toHaveLength(46)
  })
})

describe("categoryFor", () => {
  it("keeps a post's fixed category over its WordPress ones", () => {
    expect(categoryFor(5480, ["program-2026"])).toEqual({
      kind: "category",
      slug: "motesplats-ekebacken",
    })
  })
  it("otherwise maps as pickCategory does", () => {
    expect(categoryFor(7691, ["exkursioner", "program-2026"])).toEqual({
      kind: "category",
      slug: "exkursioner",
    })
  })
})
