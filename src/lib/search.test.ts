import { describe, expect, it } from "vitest"

import { matchesName, normaliseSearchQuery, searchFilter } from "./search"

describe("normaliseSearchQuery", () => {
  it("tidies what a form sends", () => {
    expect(normaliseSearchQuery("  gråhäger \n i  Timsfors ")).toBe("gråhäger i Timsfors")
  })

  it("treats nothing as nothing", () => {
    expect(normaliseSearchQuery(null)).toBe("")
    expect(normaliseSearchQuery("   ")).toBe("")
  })

  it("stops a very long query", () => {
    expect(normaliseSearchQuery("a".repeat(500))).toHaveLength(100)
  })
})

describe("searchFilter", () => {
  it("asks the index and the title", () => {
    expect(searchFilter("uggla")).toBe('search.wfts(swedish)."uggla",title.ilike."*uggla*"')
  })

  it("can't be broken out of with PostgREST syntax", () => {
    const filter = searchFilter('a",id.gt.0,title.eq."b')
    expect(filter).toContain('"a\\",id.gt.0,title.eq.\\"b"')
  })

  it("escapes a backslash before it can escape the closing quote", () => {
    expect(searchFilter("a\\")).toContain('"a\\\\"')
  })

  it("keeps ilike's wildcard out of the title match", () => {
    expect(searchFilter("a*b")).toContain('title.ilike."*ab*"')
    expect(searchFilter("a%b_c")).toContain('title.ilike."*abc*"')
  })

  it("leaves out the title match when only wildcards were typed", () => {
    for (const query of ["*", "%", "_", "\\"]) {
      expect(searchFilter(query)).not.toContain("ilike")
    }
  })
})

describe("matchesName", () => {
  it("ignores case, å and ä included", () => {
    expect(matchesName("Ångabäck", "ÅNGA")).toBe(true)
    expect(matchesName("Ekebacken", "ånga")).toBe(false)
  })
})
