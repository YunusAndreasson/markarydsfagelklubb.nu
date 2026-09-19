import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"
import { createFetchWithTimeout } from "./fetch"

/**
 * Browser client for the admin island.
 *
 * The URL and publishable key arrive as props from the server-rendered page
 * rather than from `import.meta.env`, so the Worker environment stays the one
 * source of truth for both and there is no second copy in a `.env` to drift.
 *
 * `createBrowserClient` is a singleton keyed internally, and it reads the same
 * cookies the server client writes, so the session is shared with SSR.
 */
export function getSupabaseBrowserClient(
  supabaseUrl: string,
  supabasePublishableKey: string
): SupabaseClient<Database> {
  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey, {
    global: { fetch: createFetchWithTimeout() },
  })
}
