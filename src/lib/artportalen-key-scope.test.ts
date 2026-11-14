import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * The Artportalen key's reach, enforced against the source tree, as
 * `secret-key-scope.test.ts` does for the Supabase secret key.
 *
 * The key is personal to the account that subscribed to SLU's API, and SLU asks
 * that it stay on a server. Only the scheduled handler reads it and hands it to
 * the client; pages read the statistics from KV and never hold it.
 */

const SRC = fileURLToPath(new URL("../", import.meta.url))

/** Parse or forward the key. */
const PLUMBING = ["lib/env.ts", "lib/worker-env.ts"]

/** May build a client: the scheduled handler, and the jobs that take one as a parameter. */
const ALLOWED = ["worker.ts", "lib/artportalen/client.ts", "lib/artportalen/jobs.ts"]

const REACHES_KEY =
  /readArtportalenEnv|ARTPORTALEN_API_KEY|artportalen\/client|artportalen\/jobs|from "\.\/client"/

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const files = walk(SRC)
  .map((file) => file.slice(SRC.length))
  .filter((file) => /\.(ts|tsx|astro)$/.test(file) && !file.endsWith(".test.ts"))

const source = (file: string) => readFileSync(join(SRC, file), "utf8")

describe("the Artportalen key's reach", () => {
  it("is reachable only from the scheduled handler and the jobs", () => {
    const reaching = files
      .filter((file) => !PLUMBING.includes(file))
      .filter((file) => REACHES_KEY.test(source(file)))
      .sort()
    expect(reaching).toEqual(
      [...ALLOWED].filter((file) => file !== "lib/artportalen/client.ts").sort()
    )
  })

  it("never reaches a page, a component or an island", () => {
    for (const file of files.filter(
      (one) => /^(pages|components|layouts)\//.test(one) || one.endsWith(".tsx")
    )) {
      expect(REACHES_KEY.test(source(file)), file).toBe(false)
    }
  })

  it("is sent only to SLU's API", () => {
    const client = source("lib/artportalen/client.ts")
    expect(client).toMatch(/const API = "https:\/\/api\.artdatabanken\.se\//)
    expect(client.match(/fetchImpl\(/g)).toHaveLength(1)
  })
})
