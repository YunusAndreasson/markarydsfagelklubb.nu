/**
 * Worker environment, parsed strictly.
 *
 * Pure on purpose — `worker-env.ts` feeds it `cloudflare:workers`, the tests
 * feed it plain objects. A missing value is reported, never defaulted: a
 * `SECRET || publishable` style fallback turns a startup failure into an
 * opaque permission error on every request, which is far harder to diagnose
 * than a loud 500.
 */
export type ServerEnv = {
  supabaseUrl: string
  supabasePublishableKey: string
}

export type ServerEnvResult = { ok: true; env: ServerEnv } | { ok: false; problems: string[] }

function readString(source: Record<string, unknown>, name: string): string | null {
  const value = source[name]
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

export function parseServerEnv(source: Record<string, unknown>): ServerEnvResult {
  const problems: string[] = []

  const supabaseUrl = readString(source, "SUPABASE_URL")
  if (!supabaseUrl) {
    problems.push("SUPABASE_URL is missing")
  } else if (!URL.canParse(supabaseUrl)) {
    problems.push("SUPABASE_URL is not a URL")
  }

  const supabasePublishableKey = readString(source, "SUPABASE_PUBLISHABLE_KEY")
  if (!supabasePublishableKey) {
    problems.push("SUPABASE_PUBLISHABLE_KEY is missing")
  } else if (supabasePublishableKey.startsWith("sb_secret_")) {
    // This value is handed to the browser. A secret key here would bypass RLS
    // for anyone who opened devtools — on a database the live app shares — so
    // refuse to start rather than serve it.
    problems.push(
      "SUPABASE_PUBLISHABLE_KEY holds a secret key (sb_secret_*), which must never reach the browser"
    )
  }

  if (problems.length > 0 || !supabaseUrl || !supabasePublishableKey) {
    return { ok: false, problems }
  }
  return { ok: true, env: { supabaseUrl, supabasePublishableKey } }
}

export type AlertsEnv = {
  supabaseUrl: string
  /**
   * An `sb_secret_*` key. It bypasses RLS on the database the live app shares,
   * so it belongs to the Worker and to `/larm*` alone — see
   * `supabase-secret.ts` and the scope test beside it.
   */
  supabaseSecretKey: string
}

export type AlertsEnvResult = { ok: true; env: AlertsEnv } | { ok: false; problems: string[] }

/**
 * The larm feed's environment, parsed apart from `parseServerEnv` on purpose.
 *
 * Required there, a missing secret would 500 the whole site, and nobody could
 * run `pnpm dev` on the articles without a production key. Optional there
 * would mean defaulting a missing value, which this file exists to refuse. So
 * it is a second parser with a second failure, and only `/larm*` answers 503.
 */
export function parseAlertsEnv(source: Record<string, unknown>): AlertsEnvResult {
  const problems: string[] = []

  const supabaseUrl = readString(source, "SUPABASE_URL")
  if (!supabaseUrl) {
    problems.push("SUPABASE_URL is missing")
  } else if (!URL.canParse(supabaseUrl)) {
    problems.push("SUPABASE_URL is not a URL")
  }

  const supabaseSecretKey = readString(source, "SUPABASE_SECRET_KEY")
  if (!supabaseSecretKey) {
    problems.push("SUPABASE_SECRET_KEY is missing")
  } else if (!supabaseSecretKey.startsWith("sb_secret_")) {
    // The mirror of the guard above, and the one that saves an afternoon: a
    // publishable key here doesn't error. RLS applies, every larm query comes
    // back empty, and the site quietly reports "inga larm" instead of a
    // misconfiguration.
    problems.push("SUPABASE_SECRET_KEY is not a secret key (sb_secret_*)")
  }

  if (problems.length > 0 || !supabaseUrl || !supabaseSecretKey) {
    return { ok: false, problems }
  }
  return { ok: true, env: { supabaseUrl, supabaseSecretKey } }
}
