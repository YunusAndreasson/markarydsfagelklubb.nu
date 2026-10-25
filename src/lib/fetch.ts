/** Every network call gets a deadline. */
export const REQUEST_TIMEOUT_MS = 20_000

/**
 * `fetch` has no timeout and neither does supabase-js, so a request that lands
 * on a dead pooled socket hangs rather than errors — measured at 87s in a
 * sibling repo. A hang is worse than a failure because nothing retries it.
 *
 * Combines the caller's signal with the deadline instead of replacing it, so
 * `.abortSignal()` and the auth client's own cancellation keep working.
 *
 * The deadline covers the wait for the response, not the body: a larm photo
 * streams through to the visitor at the visitor's pace. That is why this is a
 * cleared timer and not `AbortSignal.timeout()`, which can't be stopped.
 */
export function createFetchWithTimeout(timeoutMs = REQUEST_TIMEOUT_MS): typeof fetch {
  return async (input, init) => {
    const deadline = new AbortController()
    const timer = setTimeout(
      () => deadline.abort(new DOMException("Request timed out", "TimeoutError")),
      timeoutMs
    )
    const signal = init?.signal ? AbortSignal.any([init.signal, deadline.signal]) : deadline.signal
    try {
      return await fetch(input, { ...init, signal })
    } finally {
      clearTimeout(timer)
    }
  }
}
