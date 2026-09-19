/**
 * Parse a `Cookie` request header into the shape `@supabase/ssr` expects from
 * `cookies.getAll()`.
 *
 * Hand-rolled rather than imported so the middleware does not depend on an
 * internal helper of either Astro or @supabase/ssr — both have moved this API
 * between versions, and a silent change here manifests as random logouts.
 */
export function parseCookieHeader(header: string | null): { name: string; value: string }[] {
  if (!header) return []

  const cookies: { name: string; value: string }[] = []
  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=")
    if (separator < 1) continue

    const name = pair.slice(0, separator).trim()
    if (!name) continue

    const raw = pair.slice(separator + 1).trim()
    let value: string
    try {
      value = decodeURIComponent(raw)
    } catch {
      // A malformed percent-escape must not take down the whole request —
      // fall back to the raw value and let Supabase reject it if it is junk.
      value = raw
    }
    cookies.push({ name, value })
  }
  return cookies
}
