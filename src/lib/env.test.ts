import { describe, expect, it } from "vitest"

import { parseAlertsEnv, parseServerEnv } from "./env"

const URL_OK = "https://zgnmajovyqibgxlcomvb.supabase.co"
const KEY_OK = "sb_publishable_example"
const SECRET_OK = "sb_secret_example"

describe("parseServerEnv", () => {
  it("accepts a URL and a publishable key, trimmed", () => {
    expect(
      parseServerEnv({ SUPABASE_URL: ` ${URL_OK} `, SUPABASE_PUBLISHABLE_KEY: `${KEY_OK}\n` })
    ).toEqual({ ok: true, env: { supabaseUrl: URL_OK, supabasePublishableKey: KEY_OK } })
  })

  it("names every missing value instead of defaulting", () => {
    expect(parseServerEnv({})).toEqual({
      ok: false,
      problems: ["SUPABASE_URL is missing", "SUPABASE_PUBLISHABLE_KEY is missing"],
    })
  })

  it("treats blank and non-string values as missing", () => {
    const result = parseServerEnv({ SUPABASE_URL: "   ", SUPABASE_PUBLISHABLE_KEY: 42 })
    expect(result.ok).toBe(false)
  })

  it("rejects a value that is not a URL", () => {
    expect(
      parseServerEnv({ SUPABASE_URL: "zgnmajovyqibgxlcomvb", SUPABASE_PUBLISHABLE_KEY: KEY_OK })
    ).toEqual({ ok: false, problems: ["SUPABASE_URL is not a URL"] })
  })

  it("refuses to hand a secret key to the browser", () => {
    const result = parseServerEnv({
      SUPABASE_URL: URL_OK,
      SUPABASE_PUBLISHABLE_KEY: "sb_secret_oops",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems[0]).toMatch(/secret key/)
  })

  it("does not ask for the secret key, so the site runs without one", () => {
    // Only /larm* needs it. Requiring it here would 500 every page — and stop
    // anyone developing the articles without a production key.
    expect(parseServerEnv({ SUPABASE_URL: URL_OK, SUPABASE_PUBLISHABLE_KEY: KEY_OK }).ok).toBe(true)
  })
})

describe("parseAlertsEnv", () => {
  it("accepts a URL and a secret key, trimmed", () => {
    expect(
      parseAlertsEnv({ SUPABASE_URL: ` ${URL_OK} `, SUPABASE_SECRET_KEY: `${SECRET_OK}\n` })
    ).toEqual({ ok: true, env: { supabaseUrl: URL_OK, supabaseSecretKey: SECRET_OK } })
  })

  it("names every missing value instead of defaulting", () => {
    expect(parseAlertsEnv({})).toEqual({
      ok: false,
      problems: ["SUPABASE_URL is missing", "SUPABASE_SECRET_KEY is missing"],
    })
  })

  it("rejects a publishable key in the secret slot, which would fail silently", () => {
    // With RLS applying, every larm query would return zero rows and the page
    // would say "inga larm" — a misconfiguration disguised as an empty feed.
    const result = parseAlertsEnv({ SUPABASE_URL: URL_OK, SUPABASE_SECRET_KEY: KEY_OK })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems[0]).toMatch(/not a secret key/)
  })

  it("treats blank and non-string values as missing", () => {
    expect(parseAlertsEnv({ SUPABASE_URL: URL_OK, SUPABASE_SECRET_KEY: "   " }).ok).toBe(false)
    expect(parseAlertsEnv({ SUPABASE_URL: URL_OK, SUPABASE_SECRET_KEY: 42 }).ok).toBe(false)
  })
})
