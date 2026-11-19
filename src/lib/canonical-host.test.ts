import { describe, expect, it } from "vitest"
import { canonicalRedirect, visitorScheme } from "./canonical-host"

describe("canonicalRedirect", () => {
  it("sends www and workers.dev to the same path on the apex", () => {
    expect(canonicalRedirect(new URL("https://www.markarydsfagelklubb.nu/larm?sida=2"))).toBe(
      "https://markarydsfagelklubb.nu/larm?sida=2"
    )
    expect(canonicalRedirect(new URL("https://mafk-web.jonas-268.workers.dev/"))).toBe(
      "https://markarydsfagelklubb.nu/"
    )
  })

  it("sends plain http on the apex, and on www, to https", () => {
    expect(
      canonicalRedirect(new URL("http://markarydsfagelklubb.nu/artiklar?sida=2"), "http")
    ).toBe("https://markarydsfagelklubb.nu/artiklar?sida=2")
    expect(canonicalRedirect(new URL("http://www.markarydsfagelklubb.nu/"), "http")).toBe(
      "https://markarydsfagelklubb.nu/"
    )
  })

  it("serves the apex over http when the edge reports no scheme (wrangler dev)", () => {
    expect(canonicalRedirect(new URL("http://markarydsfagelklubb.nu/artiklar"))).toBeNull()
    expect(canonicalRedirect(new URL("http://markarydsfagelklubb.nu/"), null)).toBeNull()
  })

  it("serves the apex, local dev and the API where they are", () => {
    expect(canonicalRedirect(new URL("https://markarydsfagelklubb.nu/obsar"), "https")).toBeNull()
    expect(canonicalRedirect(new URL("http://localhost:8787/"), "http")).toBeNull()
    expect(
      canonicalRedirect(new URL("https://mafk-web.jonas-268.workers.dev/api/health"))
    ).toBeNull()
    expect(
      canonicalRedirect(new URL("http://markarydsfagelklubb.nu/api/health"), "http")
    ).toBeNull()
  })
})

describe("visitorScheme", () => {
  it("reads CF-Visitor first, then X-Forwarded-Proto", () => {
    expect(visitorScheme(new Headers({ "cf-visitor": '{"scheme":"http"}' }))).toBe("http")
    expect(
      visitorScheme(
        new Headers({ "cf-visitor": '{"scheme":"https"}', "x-forwarded-proto": "http" })
      )
    ).toBe("https")
    expect(visitorScheme(new Headers({ "x-forwarded-proto": "http" }))).toBe("http")
  })

  it("is null with neither header, or a malformed CF-Visitor alone", () => {
    expect(visitorScheme(new Headers())).toBeNull()
    expect(visitorScheme(new Headers({ "cf-visitor": "not json" }))).toBeNull()
  })
})
