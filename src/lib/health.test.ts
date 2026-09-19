import { describe, expect, it } from "vitest"

import { checkSupabaseAuth, healthResponse } from "./health"

const URL_OK = "https://project-ref.supabase.co"

function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: { url: string; headers: Headers }[] = []
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers) })
    return respond()
  }) as typeof fetch
  return { impl, calls }
}

describe("checkSupabaseAuth", () => {
  it("sends the key on the apikey header, not as a bearer token", async () => {
    const { impl, calls } = fakeFetch(() => new Response("{}"))
    await expect(checkSupabaseAuth(URL_OK, "sb_publishable_x", impl)).resolves.toBe("ok")
    expect(calls[0]?.url).toBe(`${URL_OK}/auth/v1/health`)
    expect(calls[0]?.headers.get("apikey")).toBe("sb_publishable_x")
    expect(calls[0]?.headers.has("authorization")).toBe(false)
  })

  it("reports a key the gateway refuses as rejected", async () => {
    const { impl } = fakeFetch(() => new Response("{}", { status: 401 }))
    await expect(checkSupabaseAuth(URL_OK, "bad", impl)).resolves.toBe("rejected")
  })

  it("reports upstream errors and network failures as unreachable", async () => {
    const down = fakeFetch(() => new Response("", { status: 502 }))
    await expect(checkSupabaseAuth(URL_OK, "k", down.impl)).resolves.toBe("unreachable")

    const timeout = fakeFetch(() => Promise.reject(new Error("Request timed out")))
    await expect(checkSupabaseAuth(URL_OK, "k", timeout.impl)).resolves.toBe("unreachable")
  })
})

describe("healthResponse", () => {
  it("is 200 only when Supabase is ok, and never cacheable", async () => {
    const ok = healthResponse("ok")
    expect(ok.status).toBe(200)
    expect(ok.headers.get("Cache-Control")).toBe("no-store")
    await expect(ok.json()).resolves.toEqual({ status: "ok", supabase: "ok" })

    const degraded = healthResponse("rejected")
    expect(degraded.status).toBe(503)
    await expect(degraded.json()).resolves.toEqual({ status: "degraded", supabase: "rejected" })
  })
})
