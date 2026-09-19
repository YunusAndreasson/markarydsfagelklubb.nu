import { defineMiddleware } from "astro:middleware"
import { decideAdminAccess, isAdminPath, type SessionKind } from "@/lib/admin-access"
import { readIsAdmin } from "@/lib/admin-flag"
import { applySecurityHeaders, supabaseConnectOrigins } from "@/lib/security-headers"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { readServerEnv } from "@/lib/worker-env"

const API_PREFIX = "/api/"

function plainResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  })
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url

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
    return applySecurityHeaders(plainResponse("server_misconfigured", 500))
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

  // Authentication is not authorisation: sign-up is open for the app, so any
  // member can hold a valid session. Only `profiles.is_admin` opens /admin.
  let session: SessionKind = "none"
  if (claims) {
    const isAdmin = await readIsAdmin(supabase, claims.sub)
    if (isAdmin === null) {
      return applySecurityHeaders(
        plainResponse("Administrationen är inte tillgänglig just nu. Försök igen om en stund.", 503)
      )
    }
    session = isAdmin ? "admin" : "member"
  }
  context.locals.isAdmin = session === "admin"

  // One exit point, so redirects get the same headers as rendered pages.
  const access = decideAdminAccess(pathname, search, session)
  const response =
    access.kind === "redirect" ? context.redirect(access.location, 303) : await next()

  // Headers @supabase/ssr asks for whenever it writes auth cookies. A CDN that
  // cached a Set-Cookie response would serve one admin's session to the next.
  for (const [key, value] of authResponseHeaders) {
    response.headers.set(key, value)
  }

  // The admin area is per-session. Nothing between here and the browser may
  // hold on to it — including the redirect that bounces a signed-out visitor.
  response.headers.set("Cache-Control", "private, no-store")
  return applySecurityHeaders(response, supabaseConnectOrigins(result.env.supabaseUrl))
})
