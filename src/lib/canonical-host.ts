/**
 * The site has one address (docs/roadmap.md, step 9). The Worker also answers
 * on `www.`, on its workers.dev name and on the apex over plain http; each
 * sends a visitor, and a search engine, to the same path on the apex over
 * https, so no page exists under two names. Until 2026-11-19 http:// served
 * every page, and Search Console counted each one twice.
 */
export const SITE_ORIGIN = "https://markarydsfagelklubb.nu"

const SITE_HOST = new URL(SITE_ORIGIN).hostname

/**
 * A page's one address for search engines: the apex over https and the bare
 * path, whichever host or scheme the request came on, without its query. A
 * prerendered page is also served at its file's name (`…-appen.html`); the
 * `.html` is dropped so both name the address the site links to.
 */
export function canonicalUrl(pathname: string): string {
  return new URL(pathname.replace(/\.html$/, ""), SITE_ORIGIN).href
}

const OTHER_HOSTS: ReadonlySet<string> = new Set([
  "www.markarydsfagelklubb.nu",
  "mafk-web.jonas-268.workers.dev",
])

/**
 * The scheme the visitor used, as Cloudflare's edge reports it: `CF-Visitor`
 * (`{"scheme":"http"}`), else `X-Forwarded-Proto`. Null when neither is there,
 * as under `wrangler dev`, which rewrites every local request to
 * `http://markarydsfagelklubb.nu/…` and so must not be sent to https.
 */
export function visitorScheme(headers: Headers): string | null {
  const visitor = headers.get("cf-visitor")
  if (visitor) {
    try {
      const scheme = (JSON.parse(visitor) as { scheme?: unknown }).scheme
      if (typeof scheme === "string") return scheme
    } catch {
      // Malformed: fall through to the other header.
    }
  }
  return headers.get("x-forwarded-proto")
}

/**
 * Where a request on another of the Worker's hosts or schemes belongs, or null
 * to serve it here. `/api/*` answers on every host: the deploy's smoke test
 * checks `/api/health` on workers.dev, whatever the custom domain is doing.
 * Plain http moves only when the edge says the visitor came over http.
 */
export function canonicalRedirect(url: URL, scheme: string | null = null): string | null {
  const plainHttp = scheme === "http" && url.protocol === "http:" && url.hostname === SITE_HOST
  if (!plainHttp && !OTHER_HOSTS.has(url.hostname)) return null
  if (url.pathname.startsWith("/api/")) return null
  return `${SITE_ORIGIN}${url.pathname}${url.search}`
}
