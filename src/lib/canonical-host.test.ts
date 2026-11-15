import { describe, expect, it } from "vitest"
import { canonicalRedirect } from "./canonical-host"

describe("canonicalRedirect", () => {
  it("sends www and workers.dev to the same path on the apex", () => {
    expect(canonicalRedirect(new URL("https://www.markarydsfagelklubb.nu/larm?sida=2"))).toBe(
      "https://markarydsfagelklubb.nu/larm?sida=2"
    )
    expect(canonicalRedirect(new URL("https://mafk-web.jonas-268.workers.dev/"))).toBe(
      "https://markarydsfagelklubb.nu/"
    )
  })

  it("serves the apex, local dev and the API where they are", () => {
    expect(canonicalRedirect(new URL("https://markarydsfagelklubb.nu/obsar"))).toBeNull()
    expect(canonicalRedirect(new URL("http://localhost:8787/"))).toBeNull()
    expect(
      canonicalRedirect(new URL("https://mafk-web.jonas-268.workers.dev/api/health"))
    ).toBeNull()
  })
})
