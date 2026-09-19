/**
 * Where embedded content may come from (docs/roadmap.md, D5).
 *
 * One list feeds both the sanitizer, which decides which iframes survive a
 * save, and the CSP `frame-src`, which decides which iframes the browser will
 * load. A test keeps the two in step.
 *
 * Dependency-free on purpose: the middleware reaches this through the security
 * headers on every request, and it must not pull the sanitizer's HTML parser
 * into the Worker's cold start.
 */

export type EmbedSource = {
  /** Scheme and host, exactly as a CSP source expression writes them. */
  origin: string
  /**
   * CSP path semantics: a path ending in "/" allows everything below it, any
   * other path allows exactly that path (the query string is never matched).
   */
  path: string
}

export const EMBED_SOURCES: readonly EmbedSource[] = Object.freeze([
  // Artportalen maps and species lists, used on the lokal pages.
  { origin: "https://www.artportalen.se", path: "/" },
  { origin: "https://artportalen.se", path: "/" },
  // Google Maps, the embed endpoint only: https://www.google.com/maps/embed?pb=…
  { origin: "https://www.google.com", path: "/maps/embed" },
])

function pathAllowed(pathname: string, path: string): boolean {
  return path.endsWith("/") ? pathname.startsWith(path) : pathname === path
}

/** True when `src` is an https URL one of the embed sources allows. */
export function isAllowedEmbed(src: string): boolean {
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return false
  }
  if (url.protocol !== "https:" || url.username || url.password) return false
  return EMBED_SOURCES.some(
    (source) => url.origin === source.origin && pathAllowed(url.pathname, source.path)
  )
}

/** The `frame-src` source list: origins alone when every path is allowed. */
export function embedFrameSources(): string[] {
  return EMBED_SOURCES.map((source) =>
    source.path === "/" ? source.origin : `${source.origin}${source.path}`
  )
}
