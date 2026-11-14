import { handle } from "@astrojs/cloudflare/handler"
import { createClient } from "@/lib/artportalen/client"
import { FAST_CRON, NIGHTLY_CRON, runFast, runNightly } from "@/lib/artportalen/jobs"
import { readArtportalenEnv, readObsarKv } from "@/lib/worker-env"

/**
 * The Worker: Astro's handler for requests, plus the scheduled jobs that read
 * Artportalen into KV (docs/roadmap.md, step 10). `wrangler.jsonc` `main`
 * points here, and its `triggers.crons` must list the same two expressions.
 */
export default {
  fetch: handle,

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
      job.then((result) => {
        if (result.ok) console.log("obsar: done", { cron: controller.cron, ...result })
        else console.error("obsar: failed", { cron: controller.cron, ...result })
      })
    )
  },
} satisfies ExportedHandler<Env>
