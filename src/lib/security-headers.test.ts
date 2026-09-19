import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { applySecurityHeaders, SECURITY_HEADERS, supabaseConnectOrigins } from "./security-headers"

/**
 * Parse the `/*` block out of a Cloudflare `_headers` file.
 * Indented lines belong to the preceding path rule; `#` lines are comments.
 */
/** Every path rule declared in the file (non-indented, non-comment lines). */
function parseRulePaths(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.trimStart().startsWith("#") && !/^\s/.test(line))
    .map((line) => line.trim())
}

function parseGlobalBlock(source: string): Record<string, string> {
  const headers: Record<string, string> = {}
  let inGlobalBlock = false

  for (const rawLine of source.split("\n")) {
    if (rawLine.trim() === "" || rawLine.trimStart().startsWith("#")) continue

    const isRule = !/^\s/.test(rawLine)
    if (isRule) {
      inGlobalBlock = rawLine.trim() === "/*"
      continue
    }

    if (!inGlobalBlock) continue
    const separator = rawLine.indexOf(":")
    if (separator === -1) continue
    headers[rawLine.slice(0, separator).trim()] = rawLine.slice(separator + 1).trim()
  }
  return headers
}

const headersFile = readFileSync(
  fileURLToPath(new URL("../../public/_headers", import.meta.url)),
  "utf8"
)

describe("public/_headers", () => {
  it("sets exactly the same /* headers the Worker applies", () => {
    // Static assets go through _headers; Worker responses do not. If these two
    // drift, the admin area silently loses its security headers.
    expect(parseGlobalBlock(headersFile)).toEqual({ ...SECURITY_HEADERS })
  })

  it("keeps Cache-Control off /*", () => {
    // Cloudflare concatenates same-named headers rather than letting the more
    // specific rule win, and browsers honour the first value they read — so a
    // Cache-Control here would override every prefix rule below it.
    expect(parseGlobalBlock(headersFile)).not.toHaveProperty("Cache-Control")
  })

  it("leaves the /_astro/* rule to the adapter", () => {
    // @astrojs/cloudflare injects the immutable Cache-Control for /_astro/* at
    // build time. Declaring it here too would produce two rules matching the
    // same path, and Cloudflare concatenates rather than overrides.
    // Checked against parsed RULES, not raw text — the file mentions the path
    // in a comment explaining exactly this.
    expect(parseRulePaths(headersFile)).toEqual(["/*"])
  })
})

describe("admin connect-src", () => {
  it("allows only the configured hosted Supabase API and Storage origins", () => {
    const origins = supabaseConnectOrigins("https://project-ref.supabase.co")
    expect(origins).toEqual([
      "https://project-ref.supabase.co",
      "https://project-ref.storage.supabase.co",
    ])
    const response = applySecurityHeaders(new Response(), origins)
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "connect-src 'self' https://project-ref.supabase.co https://project-ref.storage.supabase.co;"
    )
  })

  it("supports local Supabase without inventing a hosted Storage origin", () => {
    expect(supabaseConnectOrigins("http://127.0.0.1:54321")).toEqual(["http://127.0.0.1:54321"])
  })

  it("ignores invalid and non-http URLs", () => {
    expect(supabaseConnectOrigins("not a url")).toEqual([])
    expect(supabaseConnectOrigins("javascript:alert(1)")).toEqual([])
  })
})
