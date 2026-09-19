/** Every network call gets a deadline. */
export const REQUEST_TIMEOUT_MS = 20_000

/**
 * `fetch` has no timeout and neither does supabase-js, so a request that lands
 * on a dead pooled socket hangs rather than errors — measured at 87s in a
 * sibling repo. A hang is worse than a failure because nothing retries it.
 *
 * Chains the caller's signal instead of replacing it, so `.abortSignal()` and
 * the auth client's own cancellation keep working.
 */
export function createFetchWithTimeout(timeoutMs = REQUEST_TIMEOUT_MS): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController()
    const callerSignal = init?.signal

    if (callerSignal?.aborted) controller.abort(callerSignal.reason)
    const abortFromCaller = () => controller.abort(callerSignal?.reason)
    callerSignal?.addEventListener("abort", abortFromCaller)

    const timeout = setTimeout(() => controller.abort(new Error("Request timed out")), timeoutMs)
    try {
      return await fetch(input, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timeout)
      callerSignal?.removeEventListener("abort", abortFromCaller)
    }
  }
}
