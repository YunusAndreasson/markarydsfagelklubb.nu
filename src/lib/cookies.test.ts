import { describe, expect, it } from "vitest"

import { parseCookieHeader } from "./cookies"

describe("parseCookieHeader", () => {
  it("returns nothing for an absent or empty header", () => {
    expect(parseCookieHeader(null)).toEqual([])
    expect(parseCookieHeader("")).toEqual([])
  })

  it("parses a single pair", () => {
    expect(parseCookieHeader("sb-access-token=abc")).toEqual([
      { name: "sb-access-token", value: "abc" },
    ])
  })

  it("parses several pairs and trims whitespace", () => {
    expect(parseCookieHeader("a=1; b=2;   c=3")).toEqual([
      { name: "a", value: "1" },
      { name: "b", value: "2" },
      { name: "c", value: "3" },
    ])
  })

  it("keeps '=' inside the value", () => {
    // base64url chunks written by @supabase/ssr are padded with '='.
    expect(parseCookieHeader("token=eyJhbGc=")).toEqual([{ name: "token", value: "eyJhbGc=" }])
  })

  it("percent-decodes, because the framework percent-encodes on write", () => {
    expect(parseCookieHeader("v=a%20b")).toEqual([{ name: "v", value: "a b" }])
  })

  it("keeps a malformed escape rather than throwing away the request", () => {
    expect(parseCookieHeader("v=100%")).toEqual([{ name: "v", value: "100%" }])
  })

  it("skips valueless and nameless fragments", () => {
    expect(parseCookieHeader("novalue; =orphan; ok=1")).toEqual([{ name: "ok", value: "1" }])
  })
})
