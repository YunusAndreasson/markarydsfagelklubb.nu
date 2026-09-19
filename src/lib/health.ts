import { createFetchWithTimeout } from "./fetch"

/** Short: the smoke test after every deploy waits on this, and retries. */
export const HEALTH_TIMEOUT_MS = 5_000

export type SupabaseHealth = "ok" | "rejected" | "unreachable" | "misconfigured"

/**
 * Probe Supabase Auth's health endpoint with the publishable key.
 *
 * The gateway validates `apikey` on this route too (a wrong key is a 401), so
 * one request proves the URL, the key and the network path from the Worker.
 * New-format keys go on the `apikey` header — never `Authorization: Bearer`.
 */
export async function checkSupabaseAuth(
  supabaseUrl: string,
  publishableKey: string,
  fetchImpl: typeof fetch = createFetchWithTimeout(HEALTH_TIMEOUT_MS)
): Promise<SupabaseHealth> {
  try {
    const response = await fetchImpl(new URL("/auth/v1/health", supabaseUrl), {
      headers: { apikey: publishableKey },
    })
    // An unread body pins the connection in the Workers runtime.
    await response.body?.cancel()
    if (response.ok) return "ok"
    if (response.status === 401 || response.status === 403) return "rejected"
    return "unreachable"
  } catch {
    return "unreachable"
  }
}

/**
 * The public shape of `/api/health`. It reports states, never values: no URL,
 * no key, no upstream error text.
 */
export function healthResponse(supabase: SupabaseHealth): Response {
  const ok = supabase === "ok"
  return Response.json(
    { status: ok ? "ok" : "degraded", supabase },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  )
}
