import { env } from "cloudflare:workers"
import type { Kv } from "./artportalen/store"
import {
  type AlertsEnvResult,
  type ArtportalenEnvResult,
  parseAlertsEnv,
  parseArtportalenEnv,
  parseServerEnv,
  type ServerEnvResult,
} from "./env"

/**
 * Bindings and vars come from the Workers module directly —
 * `Astro.locals.runtime` was removed from the Cloudflare adapter.
 */
export function readServerEnv(): ServerEnvResult {
  return parseServerEnv(env as unknown as Record<string, unknown>)
}

/**
 * The larm feed's own environment, including the secret key.
 *
 * Only `supabase-secret.ts` calls this. Importing it is what makes a file part
 * of the secret key's blast radius, which `secret-key-scope.test.ts` checks.
 */
export function readAlertsEnv(): AlertsEnvResult {
  return parseAlertsEnv(env as unknown as Record<string, unknown>)
}

/**
 * The Artportalen key. Only `src/worker.ts`'s scheduled handler calls this;
 * `artportalen-key-scope.test.ts` keeps it that way.
 */
export function readArtportalenEnv(): ArtportalenEnvResult {
  return parseArtportalenEnv(env as unknown as Record<string, unknown>)
}

/** The statistics store, or null when the binding is missing (reported by the caller). */
export function readObsarKv(): Kv | null {
  const kv = (env as unknown as Record<string, unknown>).OBSAR
  return kv && typeof kv === "object" && "get" in kv ? (kv as Kv) : null
}
