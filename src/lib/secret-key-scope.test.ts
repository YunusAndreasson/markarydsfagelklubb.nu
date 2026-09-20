import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * The Supabase secret key's blast radius, enforced against the source tree.
 *
 * The key bypasses RLS on the database the live app shares, so the question
 * "which code can reach it?" has to have an answer a reviewer can check. These
 * assertions are that answer. Widening the list is then a deliberate edit with
 * a diff, not something that happens because an import looked convenient.
 */

const SRC = fileURLToPath(new URL("../", import.meta.url))

/** Holds or forwards the key itself. Changing this set is the whole point. */
const PLUMBING = ["lib/env.ts", "lib/supabase-secret.ts", "lib/worker-env.ts"]

/** May open the secret backend. Everything else goes through this module. */
const ALLOWED_TO_OPEN = ["lib/public-alerts.ts"]

const REACHES_KEY = /supabase-secret|openAlertsBackend|readAlertsEnv|SUPABASE_SECRET_KEY/
const READS_LARM = /public-alerts/

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

describe("the secret key's blast radius", () => {
  it("is reachable only from the one module that reads larm", () => {
    const importers = files
      .filter((file) => !PLUMBING.includes(file))
      .filter((file) => REACHES_KEY.test(source(file)))
      .sort()
    expect(importers).toEqual([...ALLOWED_TO_OPEN].sort())
  })

  it("never reaches a React island, which would ship it to the browser", () => {
    for (const island of files.filter((file) => file.endsWith(".tsx"))) {
      const text = source(island)
      expect(REACHES_KEY.test(text), island).toBe(false)
      expect(READS_LARM.test(text), island).toBe(false)
    }
  })

  it("is read only by routes that opt out of prerendering", () => {
    // `astro build` prerenders inside workerd with .dev.vars loaded, so a
    // prerendered larm page would read the real key on a developer's machine
    // and bake member data into dist/ as a public static asset.
    const routes = files.filter(
      (file) => file.startsWith("pages/") && READS_LARM.test(source(file))
    )
    expect(routes.length, "no larm route found; has the path changed?").toBeGreaterThan(0)
    for (const route of routes) {
      expect(source(route), route).toMatch(/export const prerender = false/)
    }
  })

  it("keeps the key out of the middleware, which runs on cookie-writing requests", () => {
    // locals.db is built for every public request. An ambient secret client
    // would sit on the /admin context too, where responses carry auth cookies.
    expect(REACHES_KEY.test(source("middleware.ts"))).toBe(false)
    expect(source("env.d.ts")).not.toMatch(/Secret/i)
  })
})
