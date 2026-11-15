/**
 * Fills the LOCAL `OBSAR` KV namespace with the whole statistics set, so
 * `pnpm dev` and `pnpm preview` show real pages without waiting a week for the
 * nightly backfill. It runs the same jobs as the Worker's cron, but waits out
 * SOS's rate limit instead of stopping.
 *
 *   pnpm obsar:seed            # everything, about three minutes
 *   pnpm obsar:seed --fast     # only the newest sightings and this year
 *   pnpm obsar:seed --remote   # everything, into PRODUCTION's namespace
 *
 * The key comes from ARTPORTALEN_API_KEY, or from `.artportalen-keys` in the
 * repo root (gitignored; ARTPORTALEN_API_KEY_PRIMARY=...). It writes local KV
 * unless `--remote` says otherwise. That is for when a change to how the jobs
 * count would otherwise reach production's past years only as the nightly
 * cursor gets to them (about ten nights): ship the code first, so the crons
 * write the same shape, then seed. It only replaces the `ap:v1:*` keys the
 * jobs themselves write, and refuses `--fast`, which would upload a partial set.
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createClient } from "../src/lib/artportalen/client"
import { runFast, runNightly } from "../src/lib/artportalen/jobs"
import type { Kv } from "../src/lib/artportalen/store"

function apiKey(): string {
  if (process.env.ARTPORTALEN_API_KEY) return process.env.ARTPORTALEN_API_KEY.trim()
  const file = new URL("../.artportalen-keys", import.meta.url)
  const key = existsSync(file)
    ? /^ARTPORTALEN_API_KEY_PRIMARY=(.+)$/m.exec(readFileSync(file, "utf8"))?.[1]?.trim()
    : null
  if (!key) {
    console.error(
      "No key: set ARTPORTALEN_API_KEY or add ARTPORTALEN_API_KEY_PRIMARY to .artportalen-keys"
    )
    process.exit(1)
  }
  return key
}

/** fetch with a deadline that sleeps through a 429, and retries a timeout a few times. */
const patientFetch: typeof fetch = async (input, init) => {
  for (let timeouts = 0; ; ) {
    let response: Response
    try {
      response = await fetch(input, { ...init, signal: AbortSignal.timeout(90_000) })
    } catch (error) {
      if (++timeouts > 3) throw error
      console.log(`  timed out, trying again (${timeouts}/3)`)
      continue
    }
    if (response.status !== 429) return response
    const seconds = Number(/(\d+) seconds/.exec(await response.text())?.[1] ?? 30) + 1
    console.log(`  rate limited, waiting ${seconds}s`)
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
  }
}

const data = new Map<string, string>()
const kv: Kv = {
  async get(key) {
    const value = data.get(key)
    return value === undefined ? null : JSON.parse(value)
  },
  async put(key, value) {
    data.set(key, value)
  },
}

const remote = process.argv.includes("--remote")
if (remote && process.argv.includes("--fast")) {
  console.error("--remote uploads the whole set; leave out --fast.")
  process.exit(1)
}

const client = createClient(apiKey(), patientFetch)
const started = Date.now()

const fast = await runFast(kv, client)
console.log("fast:", fast)
let ok = fast.ok
if (!process.argv.includes("--fast")) {
  // Every past year in one go: the cursor wraps once it passes the first year.
  const nightly = await runNightly(kv, client, new Date(), 80)
  console.log("nightly:", nightly)
  ok = ok && nightly.ok
}
// A run that failed part-way holds only some keys, and some of those (the
// names, the species index) shrunk to what it reached. Uploading it would
// overwrite a good local set with a worse one, so stop and leave KV alone.
if (!ok) {
  console.error(
    `A job failed; nothing was written to ${remote ? "production" : "local"} KV. Run it again.`
  )
  process.exit(1)
}
console.log(
  `${client.calls} calls in ${Math.round((Date.now() - started) / 1000)}s, ${data.size} keys`
)

const dir = mkdtempSync(join(tmpdir(), "obsar-seed-"))
const file = join(dir, "bulk.json")
writeFileSync(file, JSON.stringify([...data].map(([key, value]) => ({ key, value }))))
execFileSync(
  "pnpm",
  [
    "exec",
    "wrangler",
    "kv",
    "bulk",
    "put",
    file,
    "--binding",
    "OBSAR",
    remote ? "--remote" : "--local",
  ],
  {
    stdio: "inherit",
  }
)
rmSync(dir, { recursive: true })
