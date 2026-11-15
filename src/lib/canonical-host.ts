/**
 * The site has one address (docs/roadmap.md, step 9). The Worker also answers
 * on `www.` and on its workers.dev name; both send a visitor, and a search
 * engine, to the same path on the apex, so no page exists under three names.
 */
export const SITE_ORIGIN = "https://markarydsfagelklubb.nu"

const OTHER_HOSTS: ReadonlySet<string> = new Set([
  "www.markarydsfagelklubb.nu",
  "mafk-web.jonas-268.workers.dev",
])

/**
 * Where a request on another of the Worker's hosts belongs, or null to serve it
 * here. `/api/*` answers on every host: the deploy's smoke test checks
 * `/api/health` on workers.dev, whatever the custom domain is doing.
 */
export function canonicalRedirect(url: URL): string | null {
  if (!OTHER_HOSTS.has(url.hostname)) return null
  if (url.pathname.startsWith("/api/")) return null
  return `${SITE_ORIGIN}${url.pathname}${url.search}`
}
