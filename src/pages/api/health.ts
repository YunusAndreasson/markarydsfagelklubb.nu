import type { APIRoute } from "astro"
import { checkSupabaseAuth, healthResponse } from "@/lib/health"
import { readServerEnv } from "@/lib/worker-env"

export const prerender = false

/**
 * Liveness plus one Supabase round trip. The deploy workflow's smoke test
 * calls this; a 503 fails the deploy job. Each hit costs one subrequest to
 * Supabase Auth's health route — cheap, but add a rate limit before anything
 * else starts depending on it.
 */
export const GET: APIRoute = async () => {
  const result = readServerEnv()
  if (!result.ok) {
    console.error(`mafk-web: server_misconfigured — ${result.problems.join("; ")}`)
    return healthResponse("misconfigured")
  }
  const supabase = await checkSupabaseAuth(
    result.env.supabaseUrl,
    result.env.supabasePublishableKey
  )
  if (supabase !== "ok") console.error(`mafk-web: health — supabase ${supabase}`)
  return healthResponse(supabase)
}
