import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"
import { createFetchWithTimeout } from "./fetch"
import { readAlertsEnv } from "./worker-env"

/**
 * The single door to the Supabase secret key.
 *
 * The larm feed publishes data from the live app's tables, and nothing there
 * is readable anonymously (docs/roadmap.md, D1). The Worker therefore reads it
 * with an `sb_secret_*` key, which **bypasses RLS on a database 46 members
 * share** — their phone numbers included. Three things keep that contained:
 *
 * 1. This module is the only one that ever holds the key. Callers get a client
 *    and a download function, never the string, so it cannot reach a log, a
 *    DTO or an error message.
 * 2. It is deliberately **not** on `App.Locals`. An ambient client would be
 *    reachable from every page, `/admin` included, whose responses carry auth
 *    cookies — and the boundary would become a `pathname.startsWith`, which is
 *    the kind of thing that drifts. An `import` is greppable and testable.
 * 3. `secret-key-scope.test.ts` fails the build if any file outside a short
 *    allowlist reaches this module, if a React island does, or if a route that
 *    does forgets `export const prerender = false`. That last one matters:
 *    `astro build` prerenders inside workerd with `.dev.vars` loaded, so a
 *    prerendered larm page would read the real key on a developer's machine
 *    and bake member data into `dist/` as a public asset.
 *
 * It also imports `cloudflare:workers` transitively, so a client bundle that
 * pulled it in would fail to resolve rather than ship.
 */

export type SupabaseSecretClient = SupabaseClient<Database>

/** The app's private bucket. Photos are streamed out of it, never linked to. */
const USER_UPLOADS_BUCKET = "user-uploads"

/** Shorter than the default: someone is waiting for this image to appear. */
const STORAGE_TIMEOUT_MS = 8_000

export type AlertsBackend = {
  /** RLS-bypassing reader. Only `public-alerts.ts` should query with it. */
  db: SupabaseSecretClient
  /** GET one object from the private bucket, streaming, key never exposed. */
  fetchUpload(objectPath: string, init?: { signal?: AbortSignal }): Promise<Response>
}

export type AlertsBackendResult =
  | { ok: true; backend: AlertsBackend }
  | { ok: false; problems: string[] }

export function openAlertsBackend(): AlertsBackendResult {
  const result = readAlertsEnv()
  if (!result.ok) return { ok: false, problems: result.problems }
  const { supabaseUrl, supabaseSecretKey } = result.env

  // Same shape as supabase-public.ts. `createClient`, not `createServerClient`:
  // it has no cookie integration at all, so it cannot read or write an auth
  // cookie even by mistake.
  const db = createClient<Database>(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: createFetchWithTimeout() },
  })

  const storageFetch = createFetchWithTimeout(STORAGE_TIMEOUT_MS)

  return {
    ok: true,
    backend: {
      db,
      fetchUpload(objectPath, init) {
        const encoded = objectPath.split("/").map(encodeURIComponent).join("/")
        const url = new URL(
          `/storage/v1/object/${USER_UPLOADS_BUCKET}/${encoded}`,
          supabaseUrl
        ).toString()
        // Both headers, which is what supabase-js itself sends for REST and
        // Storage. CLAUDE.md's "never Authorization: Bearer" is about the
        // *publishable* key on Auth routes, where a Bearer is read as a user
        // JWT; Storage authenticates the service key this way.
        return storageFetch(url, {
          signal: init?.signal,
          headers: {
            apikey: supabaseSecretKey,
            Authorization: `Bearer ${supabaseSecretKey}`,
          },
        })
      },
    },
  }
}
