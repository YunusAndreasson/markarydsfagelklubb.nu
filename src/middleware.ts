import { defineMiddleware } from "astro:middleware"
import { applySecurityHeaders, supabaseConnectOrigins } from "@/lib/security-headers"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { readServerEnv } from "@/lib/worker-env"

const ADMIN_PATH = "/admin"
const API_PREFIX = "/api/"

function isAdminPath(pathname: string): boolean {
  // Not a bare startsWith: "/administration" is not the admin area.
  return pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`)
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url

  // Public routes are prerendered at build time and have no session. Returning
  // before touching the Worker environment keeps the build from needing any
  // Supabase configuration at all.
  //
  // Static assets get their security headers from public/_headers. Worker
  // responses never pass through that file, so /api/* and /admin/* set them here.
  if (!isAdminPath(pathname)) {
    const response = await next()
    return pathname.startsWith(API_PREFIX) ? applySecurityHeaders(response) : response
  }

  const result = readServerEnv()
  if (!result.ok) {
    // Name the offending variables in the log, never in the response body.
    // Joined into the message: wrangler's console formatter truncates objects.
    console.error(`mafk-web: server_misconfigured — ${result.problems.join("; ")}`)
    return applySecurityHeaders(
      new Response("server_misconfigured", {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      })
    )
  }

  const { supabase, authResponseHeaders } = createSupabaseServerClient(
    context,
    result.env.supabaseUrl,
    result.env.supabasePublishableKey
  )
  context.locals.supabase = supabase

  // getClaims() verifies the JWT locally against the project's asymmetric
  // signing keys. getUser() would be an Auth-server round trip per request.
  const { data, error } = await supabase.auth.getClaims()
  const claims = error ? null : (data?.claims ?? null)
  context.locals.user = claims
    ? { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null }
    : null

  // Step 2 adds the sign-in page and the authorisation gate here: redirect a
  // signed-out visitor to /admin/login, and check `private.is_admin()`
  // (profiles.is_admin, shared with the app) before rendering anything.
  const response = await next()

  // Headers @supabase/ssr asks for whenever it writes auth cookies. A CDN that
  // cached a Set-Cookie response would serve one admin's session to the next.
  for (const [key, value] of authResponseHeaders) {
    response.headers.set(key, value)
  }

  // The admin area is per-session. Nothing between here and the browser may
  // hold on to it.
  response.headers.set("Cache-Control", "private, no-store")
  return applySecurityHeaders(response, supabaseConnectOrigins(result.env.supabaseUrl))
})
