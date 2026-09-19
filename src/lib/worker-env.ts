import { env } from "cloudflare:workers"
import { parseServerEnv, type ServerEnvResult } from "./env"

/**
 * Bindings and vars come from the Workers module directly —
 * `Astro.locals.runtime` was removed from the Cloudflare adapter.
 */
export function readServerEnv(): ServerEnvResult {
  return parseServerEnv(env as unknown as Record<string, unknown>)
}
