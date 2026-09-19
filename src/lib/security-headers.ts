/**
 * Security headers applied to every response the Worker generates.
 *
 * `public/_headers` covers **static assets only** — a Worker response never
 * passes through it. Without this the admin area, the one part of the site
 * behind a session, would be the only part shipping no security headers.
 *
 * `security-headers.test.ts` asserts these stay identical to the `/*` block in
 * `public/_headers`, because the two drift silently otherwise.
 *
 * `'unsafe-inline'` in script-src covers the pre-paint theme script and Astro's
 * inline island bootstrap. `form-action 'self'` also governs where a form POST
 * may redirect to in Chromium — revisit it when admin sign-in adds an OAuth
 * hop. Any CSP change is verified in Zen (Gecko), not only Chromium.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; " +
    "base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
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
