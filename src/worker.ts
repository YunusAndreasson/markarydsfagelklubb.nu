import { handle } from "@astrojs/cloudflare/handler"
import { createClient } from "@/lib/artportalen/client"
import { FAST_CRON, NIGHTLY_CRON, runFast, runNightly } from "@/lib/artportalen/jobs"
import { readArtportalenEnv, readObsarKv } from "@/lib/worker-env"
import { slashedOldPath } from "@/lib/wp-redirects"

/**
 * The Worker: Astro's handler for requests, plus the scheduled jobs that read
 * Artportalen into KV (docs/roadmap.md, step 10). `wrangler.jsonc` `main`
 * points here, and its `triggers.crons` must list the same two expressions.
 */
export default {
  /**
   * An old WordPress URL with its trailing slash asks for its bare path first,
   * and a 301 from that (the map's, in the middleware) goes straight back: one
   * hop instead of Astro's slash redirect and then the map's. If the bare path
   * is a page after all, the request goes on as it came, and Astro strips the
   * slash as for any other URL.
   */
  async fetch(request, env, context) {
    const url = new URL(request.url)
    const bare =
      request.method === "GET" || request.method === "HEAD" ? slashedOldPath(url.pathname) : null
    if (bare) {
      url.pathname = bare
      const moved = await handle(new Request(url, request), env, context)
      if (moved.status === 301) return moved
      await moved.body?.cancel()
    }
    return handle(request, env, context)
  },

  async scheduled(controller, _env, ctx) {
    const kv = readObsarKv()
    const config = readArtportalenEnv()
    if (!kv || !config.ok) {
      console.error("obsar: server_misconfigured", {
        kv: Boolean(kv),
        problems: config.ok ? [] : config.problems,
      })
      return
    }
    const client = createClient(config.env.apiKey)
    const job =
      controller.cron === NIGHTLY_CRON
        ? runNightly(kv, client)
        : controller.cron === FAST_CRON
          ? runFast(kv, client)
          : null
    if (!job) {
      console.error("obsar: unknown cron", { cron: controller.cron })
      return
    }
    ctx.waitUntil(
      job
        .then((result) => {
          if (result.ok) console.log("obsar: done", { cron: controller.cron, ...result })
          else console.error("obsar: failed", { cron: controller.cron, ...result })
        })
        // A KV read or write outside the job's own try (its meta) would
        // otherwise be an unhandled rejection with no log line of ours.
        .catch((error: unknown) =>
          console.error("obsar: crashed", { cron: controller.cron, error: String(error) })
        )
    )
  },
} satisfies ExportedHandler<Env>
