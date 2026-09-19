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
