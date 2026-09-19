import { describe, expect, it } from "vitest"

import { parseServerEnv } from "./env"

const URL_OK = "https://zgnmajovyqibgxlcomvb.supabase.co"
const KEY_OK = "sb_publishable_example"

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
})
