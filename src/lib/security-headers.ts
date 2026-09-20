import { embedFrameSources } from "./embeds"
import { SUPABASE_ORIGIN } from "./media"

/**
 * The lokal map's tiles (docs/roadmap.md, F5).
 *
 * Raster tiles are plain `<img>` loads, so this belongs in `img-src` and
 * `connect-src` stays closed. Standard OpenStreetMap tiles need no key; their
 * usage policy asks for the attribution the map's control carries.
 */
const TILE_ORIGIN = "https://tile.openstreetmap.org"

/**
 * Security headers applied to every response the Worker generates.
 *
 * `public/_headers` covers **static assets only**: the scripts, the favicon and
 * the prerendered 404. A Worker response never passes through it, and since
 * step 3 every page is a Worker response.
 *
 * `security-headers.test.ts` asserts these stay identical to the `/*` block in
 * `public/_headers`, because the two drift silently otherwise.
 *
 * `'unsafe-inline'` in script-src covers the pre-paint theme script and Astro's
 * inline island bootstrap. It is also why a `javascript:` URL must never reach
 * an href: the sanitizer and the `pages.link_url` check both refuse them.
 * `frame-src` lists exactly the embed sources the sanitizer lets through.
 * `form-action 'self'` also governs where a form POST may redirect to in
 * Chromium. Any CSP change is verified in Zen (Gecko), not only Chromium.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: ${SUPABASE_ORIGIN} ${TILE_ORIGIN}`,
    "font-src 'self'",
    "connect-src 'self'",
    `frame-src ${embedFrameSources().join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
})

const CONNECT_SRC = "connect-src 'self'"

/**
 * Origins the authenticated browser client may reach: the project API and its
 * direct Storage hostname, and nothing else.
 */
export function supabaseConnectOrigins(supabaseUrl: string): string[] {
  let url: URL
  try {
    url = new URL(supabaseUrl)
  } catch {
    return []
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return []

  const origins = [url.origin]
  const hosted = url.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)
  if (hosted) origins.push(`${url.protocol}//${hosted[1]}.storage.supabase.co`)
  return origins
}

export function applySecurityHeaders(
  response: Response,
  connectOrigins: readonly string[] = []
): Response {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    const headerValue =
      name === "Content-Security-Policy" && connectOrigins.length > 0
        ? value.replace(CONNECT_SRC, `${CONNECT_SRC} ${[...new Set(connectOrigins)].join(" ")}`)
        : value
    response.headers.set(name, headerValue)
  }
  return response
}
