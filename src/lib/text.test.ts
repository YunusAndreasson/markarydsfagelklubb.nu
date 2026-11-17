import { describe, expect, it } from "vitest"
import { capitalize, counted, rapporter } from "./text"

describe("capitalize", () => {
  it("raises the first letter only", () => {
    expect(capitalize("fredag 30 oktober")).toBe("Fredag 30 oktober")
    expect(capitalize("ägretthäger")).toBe("Ägretthäger")
    expect(capitalize("")).toBe("")
  })
})

describe("counted", () => {
  it("joins the count and the noun with a no-break space", () => {
    expect(counted(1, "art", "arter")).toBe("1 art")
    expect(counted(2, "art", "arter")).toBe("2 arter")
  })

  it("groups thousands the Swedish way", () => {
    expect(rapporter(3187)).toBe("3 187 rapporter")
    expect(rapporter(1)).toBe("1 rapport")
  })
})
