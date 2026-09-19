import { describe, expect, it } from "vitest"

import { decideAdminAccess, isAdminPath } from "./admin-access"

describe("isAdminPath", () => {
  it("matches the bare path and everything below it", () => {
    expect(isAdminPath("/admin")).toBe(true)
    expect(isAdminPath("/admin/")).toBe(true)
    expect(isAdminPath("/admin/login")).toBe(true)
  })

  it("does not match lookalikes", () => {
    expect(isAdminPath("/administration")).toBe(false)
    expect(isAdminPath("/")).toBe(false)
    expect(isAdminPath("/api/health")).toBe(false)
  })
})

describe("decideAdminAccess", () => {
  it("renders admin pages for the administrator only", () => {
    expect(decideAdminAccess("/admin", "", "admin")).toEqual({ kind: "render" })
    expect(decideAdminAccess("/admin/sidor", "?page=2", "admin")).toEqual({ kind: "render" })
  })

  it("sends a signed-out visitor to the login page, remembering where they were", () => {
    expect(decideAdminAccess("/admin/sidor", "?page=2", "none")).toEqual({
      kind: "redirect",
      location: "/admin/login?next=%2Fadmin%2Fsidor%3Fpage%3D2",
    })
  })

  it("never renders an admin page for a signed-in member", () => {
    // Signing up is open for the app, so "signed in" proves nothing here.
    expect(decideAdminAccess("/admin", "", "member")).toEqual({
      kind: "redirect",
      location: "/admin/login?next=%2Fadmin",
    })
  })

  it("renders the login page unless the administrator is already signed in", () => {
    expect(decideAdminAccess("/admin/login", "", "none")).toEqual({ kind: "render" })
    expect(decideAdminAccess("/admin/login", "", "member")).toEqual({ kind: "render" })
    expect(decideAdminAccess("/admin/login", "?next=%2Fadmin", "admin")).toEqual({
      kind: "redirect",
      location: "/admin",
    })
  })

  it("always lets sign-out through", () => {
    for (const session of ["none", "member", "admin"] as const) {
      expect(decideAdminAccess("/admin/logout", "", session)).toEqual({ kind: "render" })
    }
  })
})
