import { describe, expect, it } from "vitest"

import { safeNext } from "./redirect"

const ORIGIN = "https://mafk.example"

describe("safeNext", () => {
  it("keeps an in-app admin path, with its query", () => {
    expect(safeNext("/admin/artiklar?page=2", ORIGIN)).toBe("/admin/artiklar?page=2")
  })

  it("falls back when absent", () => {
    expect(safeNext(null, ORIGIN)).toBe("/admin")
    expect(safeNext("", ORIGIN)).toBe("/admin")
    expect(safeNext(undefined, ORIGIN)).toBe("/admin")
  })

  it("rejects a protocol-relative URL", () => {
    // The case a path regex misses: `^/[\w\-./]*$` matches this happily, and
    // the browser reads it as another origin.
    expect(safeNext("//evil.example/x", ORIGIN)).toBe("/admin")
    expect(safeNext("//evil.example/admin", ORIGIN)).toBe("/admin")
  })

  it("rejects a backslash spelling of the same trick", () => {
    expect(safeNext("/\\evil.example/admin", ORIGIN)).toBe("/admin")
  })

  it("rejects an absolute URL to another origin", () => {
    expect(safeNext("https://evil.example/admin", ORIGIN)).toBe("/admin")
    expect(safeNext("http://mafk.example/admin", ORIGIN)).toBe("/admin")
  })

  it("rejects non-admin paths, including lookalikes", () => {
    expect(safeNext("/", ORIGIN)).toBe("/admin")
    expect(safeNext("/some/public/page", ORIGIN)).toBe("/admin")
    expect(safeNext("/administration", ORIGIN)).toBe("/admin")
  })

  it("refuses to bounce back to the login page", () => {
    expect(safeNext("/admin/login", ORIGIN)).toBe("/admin")
  })

  it("rejects a javascript: URL", () => {
    expect(safeNext("javascript:alert(1)", ORIGIN)).toBe("/admin")
  })

  it("survives an unparseable value", () => {
    expect(safeNext("http://[", ORIGIN)).toBe("/admin")
  })

  it("accepts the same origin spelled absolutely", () => {
    expect(safeNext(`${ORIGIN}/admin/sidor`, ORIGIN)).toBe("/admin/sidor")
  })
})
