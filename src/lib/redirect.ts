import { ADMIN_HOME, isAdminPath, LOGIN_PATH } from "./admin-access"

/**
 * Resolve a `?next=` parameter to a path that is safe to redirect to after
 * sign-in. (From ../mhf, with the stricter admin-path check.)
 *
 * A path regex is NOT enough: `//evil.example/x` matches `^/[\w\-./]*$` and
 * browsers treat it as a protocol-relative URL to another origin. The only
 * reliable check is to resolve against the canonical origin and compare
 * `.origin`.
 */
export function safeNext(raw: string | null | undefined, origin: string): string {
  if (!raw) return ADMIN_HOME

  let resolved: URL
  try {
    resolved = new URL(raw, origin)
  } catch {
    return ADMIN_HOME
  }

  if (resolved.origin !== new URL(origin).origin) return ADMIN_HOME

  // Sign-in only ever leads into the admin area. A `next` pointing anywhere
  // else is either a mistake or an attempt to use the login page as an open
  // redirector.
  if (!isAdminPath(resolved.pathname)) return ADMIN_HOME
  if (resolved.pathname === LOGIN_PATH) return ADMIN_HOME

  return `${resolved.pathname}${resolved.search}`
}
