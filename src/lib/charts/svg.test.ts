import { describe, expect, it } from "vitest"
import { linesSvg } from "./svg"

describe("linesSvg", () => {
  it("draws a band as one filled path under the lines", () => {
    const out = linesSvg({
      width: 100,
      height: 50,
      lines: [{ values: [1, 2, 3], color: "#000" }],
      band: { low: [0, 1, 2], high: [2, 3, 4], color: "#eee" },
    })
    const filled = out.match(/<path fill="#eee"/g) ?? []
    expect(filled).toHaveLength(1)
    // The band comes before the line, so the line sits on top.
    expect(out.indexOf('fill="#eee"')).toBeLessThan(out.indexOf('stroke="#000"'))
    // The band's top sets the scale: 4 is the top edge.
    expect(out).toContain("M0 25L50 12.5L100 0")
  })
})
