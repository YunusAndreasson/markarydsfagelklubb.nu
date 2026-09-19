import { describe, expect, it } from "vitest"

import { EMBED_SOURCES, embedFrameSources, isAllowedEmbed } from "./embeds"

describe("isAllowedEmbed", () => {
  it("allows Artportalen anywhere and Google Maps' embed endpoint", () => {
    expect(isAllowedEmbed("https://www.artportalen.se/ViewSighting/ViewSightingAsMap")).toBe(true)
    expect(isAllowedEmbed("https://artportalen.se/")).toBe(true)
    expect(isAllowedEmbed("https://www.google.com/maps/embed?pb=!1m18!1m12")).toBe(true)
  })

  it("refuses the rest of Google, and lookalike hosts", () => {
    expect(isAllowedEmbed("https://www.google.com/")).toBe(false)
    expect(isAllowedEmbed("https://www.google.com/maps/embedded")).toBe(false)
    expect(isAllowedEmbed("https://www.google.com/maps/place/Markaryd")).toBe(false)
    expect(isAllowedEmbed("https://artportalen.se.evil.example/")).toBe(false)
    expect(isAllowedEmbed("https://evilartportalen.se/")).toBe(false)
  })

  it("refuses anything that is not plain https", () => {
    expect(isAllowedEmbed("http://www.artportalen.se/")).toBe(false)
    expect(isAllowedEmbed("//www.artportalen.se/")).toBe(false)
    expect(isAllowedEmbed("javascript:alert(1)")).toBe(false)
    expect(isAllowedEmbed("https://user:pass@www.artportalen.se/")).toBe(false)
    expect(isAllowedEmbed("")).toBe(false)
  })
})

describe("embedFrameSources", () => {
  it("writes one CSP source per embed source, with a path only where it narrows", () => {
    expect(embedFrameSources()).toEqual([
      "https://www.artportalen.se",
      "https://artportalen.se",
      "https://www.google.com/maps/embed",
    ])
    expect(embedFrameSources()).toHaveLength(EMBED_SOURCES.length)
  })
})
