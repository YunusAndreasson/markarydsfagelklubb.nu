import { afterEach, describe, expect, it, vi } from "vitest"

import { createFetchWithTimeout } from "./fetch"

/** A fetch that never answers, and rejects the moment its signal aborts. */
function hangingFetch() {
  return vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))
      })
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("createFetchWithTimeout", () => {
  it("aborts a request that outlives its deadline", async () => {
    vi.stubGlobal("fetch", hangingFetch())
    await expect(createFetchWithTimeout(10)("https://example.test")).rejects.toMatchObject({
      name: "TimeoutError",
      message: "Request timed out",
    })
  })

  it("stops the clock once the response arrives, so a slow body can finish", async () => {
    let seen: AbortSignal | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        seen = init?.signal ?? undefined
        return new Response("ok")
      })
    )
    await createFetchWithTimeout(10)("https://example.test")
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(seen?.aborted).toBe(false)
  })

  it("still honours the caller's own abort signal", async () => {
    vi.stubGlobal("fetch", hangingFetch())
    const caller = new AbortController()
    const pending = createFetchWithTimeout(60_000)("https://example.test", {
      signal: caller.signal,
    })
    caller.abort(new Error("caller gave up"))
    await expect(pending).rejects.toThrow("caller gave up")
  })

  it("passes a timely response straight through", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ok"))
    )
    const response = await createFetchWithTimeout(1_000)("https://example.test")
    await expect(response.text()).resolves.toBe("ok")
  })
})
