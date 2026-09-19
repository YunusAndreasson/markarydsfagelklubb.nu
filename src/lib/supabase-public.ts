import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"
import { createFetchWithTimeout } from "./fetch"

export type SupabasePublicClient = SupabaseClient<Database>

/**
 * The client public pages read with: the publishable key and no session.
 *
 * It never reads or writes an auth cookie, so a public response can't carry
 * one visitor's session to the next and stays safe to cache. What it may see
 * is decided by the `to anon` policies alone: published, due content.
 *
 * One per request, like the admin's server client, created by the middleware.
 */
export function createSupabasePublicClient(
  supabaseUrl: string,
  supabasePublishableKey: string
): SupabasePublicClient {
  return createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: createFetchWithTimeout() },
  })
}
