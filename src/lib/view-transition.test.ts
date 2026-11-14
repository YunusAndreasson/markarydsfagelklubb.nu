import { describe, expect, it } from "vitest"

import { transitionName } from "./view-transition"

describe("transitionName", () => {
  it("gives a name once per page", () => {
    const taken = new Set<string>()
    expect(transitionName(taken, "artikel", 12)).toBe(
      "view-transition-name: artikel-12; view-transition-class: photo"
    )
    expect(transitionName(taken, "artikel", 12)).toBeUndefined()
    expect(transitionName(taken, "larm", 12)).toBe(
      "view-transition-name: larm-12; view-transition-class: photo"
    )
  })

  it("keeps an id to what a name may hold", () => {
    expect(transitionName(new Set(), "larm", "a1b2-c3.d4")).toBe(
      "view-transition-name: larm-a1b2-c3_d4; view-transition-class: photo"
    )
  })
})
