import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { APIContext } from "astro"
import { parseCookieHeader } from "./cookies"
import type { Database } from "./database.types"
import { createFetchWithTimeout } from "./fetch"

export type SupabaseServerClient = SupabaseClient<Database>

export type ServerClientBundle = {
  supabase: SupabaseServerClient
  /**
   * Headers @supabase/ssr requires on any response that sets auth cookies
   * (`Cache-Control: private, no-store`, etc.). If a CDN caches a Set-Cookie
   * response, one admin's session token gets served to the next visitor — so
   * the caller MUST copy these onto the outgoing response.
   */
  authResponseHeaders: Headers
}

/**
 * A fresh client per request. Never share one across requests: the cookie jar
 * is request-scoped, and a shared client leaks sessions between users.
 */
export function createSupabaseServerClient(
  context: APIContext,
  supabaseUrl: string,
  supabasePublishableKey: string
): ServerClientBundle {
  const authResponseHeaders = new Headers()

  const supabase = createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    global: { fetch: createFetchWithTimeout() },
    cookies: {
      getAll() {
        return parseCookieHeader(context.request.headers.get("Cookie"))
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          context.cookies.set(name, value, options)
        }
        for (const [key, headerValue] of Object.entries(headers)) {
          authResponseHeaders.set(key, headerValue)
        }
      },
    },
  })

  return { supabase, authResponseHeaders }
}
