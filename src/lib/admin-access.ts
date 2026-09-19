/**
 * Who may see which part of /admin. Pure, so the whole policy is unit-tested
 * rather than spread across the middleware.
 *
 * There is exactly one administrator (docs/roadmap.md, D2), identified by
 * `profiles.is_admin` — the same flag the app and `private.is_admin()` use.
 * RLS on the site's tables stays the real boundary; this gate only decides what
 * the browser is shown.
 */

export const ADMIN_HOME = "/admin"
export const LOGIN_PATH = "/admin/login"
export const LOGOUT_PATH = "/admin/logout"

/** Not a bare startsWith: "/administration" is not the admin area. */
export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_HOME || pathname.startsWith(`${ADMIN_HOME}/`)
}

/** Signed out, signed in without the admin flag, or the administrator. */
export type SessionKind = "none" | "member" | "admin"

export type AdminAccess = { kind: "render" } | { kind: "redirect"; location: string }

export function decideAdminAccess(
  pathname: string,
  search: string,
  session: SessionKind
): AdminAccess {
  // Sign-out must work for any session, including a stale non-admin one. It is
  // POST-only, so reaching it is harmless.
  if (pathname === LOGOUT_PATH) return { kind: "render" }

  if (pathname === LOGIN_PATH) {
    // The login page renders for everyone but the administrator. A signed-in
    // member sees why they were turned away, with a way to sign out.
    return session === "admin" ? { kind: "redirect", location: ADMIN_HOME } : { kind: "render" }
  }

  if (session === "admin") return { kind: "render" }

  const next = encodeURIComponent(`${pathname}${search}`)
  return { kind: "redirect", location: `${LOGIN_PATH}?next=${next}` }
}
