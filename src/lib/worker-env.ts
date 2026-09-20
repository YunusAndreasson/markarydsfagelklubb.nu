import { env } from "cloudflare:workers"
import { type AlertsEnvResult, parseAlertsEnv, parseServerEnv, type ServerEnvResult } from "./env"

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
