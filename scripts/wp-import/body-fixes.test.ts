import { describe, expect, it } from "vitest"
import { applyBodyFixes } from "./body-fixes"

describe("applyBodyFixes", () => {
  it("repairs a listed mistake", () => {
    expect(applyBodyFixes(10340, "<p>Vi kan kan också räkna</p>")).toEqual({
      html: "<p>Vi kan också räkna</p>",
      unmatched: [],
    })
  })

  it("keeps a post without fixes as it is", () => {
    expect(applyBodyFixes(1, "<p>Vi kan kan också</p>")).toEqual({
      html: "<p>Vi kan kan också</p>",
      unmatched: [],
    })
  })

  it("accepts text that is already fixed, and reports text that has changed", () => {
    expect(applyBodyFixes(10340, "<p>Vi kan också räkna</p>").unmatched).toEqual([])
    expect(applyBodyFixes(10340, "<p>Annan text</p>").unmatched).toEqual(["Vi kan kan också"])
  })
})
