import { describe, expect, it } from "vitest"

import { isValidSlug, SLUG_MAX_LENGTH, slugify } from "./slug"

describe("slugify", () => {
  it("transliterates Swedish the way WordPress did", () => {
    // /forsaljning/fagelholkar/ on the current site.
    expect(slugify("Fågelholkar")).toBe("fagelholkar")
    expect(slugify("Skararps ängar")).toBe("skararps-angar")
    expect(slugify("Köphultasjö")).toBe("kophultasjo")
    expect(slugify("Lördag 21 februari – Ugglespaning")).toBe("lordag-21-februari-ugglespaning")
  })

  it("keeps digits and drops punctuation, collapsing the gaps", () => {
    expect(slugify("Fågelklubbens 40-års jubileum – Inställt!")).toBe(
      "fagelklubbens-40-ars-jubileum-installt"
    )
    expect(slugify("  --Årsprogram 2026--  ")).toBe("arsprogram-2026")
  })

  it("handles letters outside Swedish", () => {
    expect(slugify("Café Øresund Straße")).toBe("cafe-oresund-strasse")
  })

  it("returns an empty string when nothing is left", () => {
    expect(slugify("!!! — ???")).toBe("")
    expect(slugify("")).toBe("")
  })

  it("cuts long titles at a word boundary", () => {
    const slug = slugify("sträckräkning ".repeat(20))
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH)
    expect(slug.endsWith("-")).toBe(false)
    expect(isValidSlug(slug)).toBe(true)
  })
})

describe("isValidSlug", () => {
  it("accepts what the database accepts", () => {
    expect(isValidSlug("om-foreningen")).toBe(true)
    expect(isValidSlug("2026")).toBe(true)
  })

  it("rejects anything else", () => {
    for (const bad of [
      "",
      "Om",
      "om--foreningen",
      "-om",
      "om-",
      "om_foreningen",
      "å",
      "a/b",
      "wp-login.php",
    ]) {
      expect(isValidSlug(bad), bad).toBe(false)
    }
  })
})
