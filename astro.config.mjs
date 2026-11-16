// @ts-check

import cloudflare from "@astrojs/cloudflare"
import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"

// https://astro.build/config
export default defineConfig({
  // Static by default, with every route that reads the database opting out
  // with `export const prerender = false`. Since step 3 that is every page but
  // the 404 (docs/roadmap.md, D4). (`output: 'hybrid'` was removed from Astro;
  // this is the current model.)
  output: "static",
  // Every WordPress URL ends in "/". "never" makes the slashless form
  // canonical, and Astro 301s /a/b/ to /a/b before the middleware runs.
  trailingSlash: "never",
  build: {
    // "directory" would write a prerendered page to x/index.html, and the
    // assets layer then 307s /x back to /x/, looping against the 301 above.
    // (404.html is named the same either way, so not_found_handling is fine.)
    format: "file",
  },
  // Supabase keeps the admin session in its own cookies. Astro sessions would
  // make the adapter auto-provision a KV namespace (`SESSION`) nothing reads.
  session: false,
  // A port of its own. 4321, Astro's default, belongs to another project on the
  // developer's machine, and falling through to the next free port made the
  // address change from one start to the next.
  server: { port: 4324 },
  adapter: cloudflare({
    // Optimise images with sharp at build time for prerendered pages, and pass
    // them through untouched at runtime. The default ("cloudflare-binding")
    // adds a billable Images binding. Revisit when articles bring uploads.
    imageService: "compile",
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss(), devScriptPaths()],
  },
})

/**
 * Dev only. `astro dev` points a component's <script> at its absolute file path
 * (`/home/…/src/components/site/SiteHeader.astro?astro&type=script…`), not at
 * `/src/…`. `run_worker_first` sends every path but Vite's own to the Worker,
 * which 404s it, so in dev the header's section panels and the photo viewer
 * never ran. Rewriting that path to Vite's `/@fs/` form, which is excluded,
 * lets Vite serve it. Builds inline or bundle these scripts and never see it.
 *
 * @typedef {(request: import("node:http").IncomingMessage, response: import("node:http").ServerResponse, next: () => void) => void} Handler
 * @typedef {{ config: { root: string }, middlewares: { use: (handler: Handler) => void } }} DevServer
 */
function devScriptPaths() {
  return {
    name: "mafk:dev-script-paths",
    apply: "serve",
    enforce: "pre",
    /** @param {DevServer} server */
    configureServer(server) {
      const root = server.config.root.replace(/\/$/, "")
      server.middlewares.use((request, _response, next) => {
        if (request.url?.startsWith(`${root}/`) && request.url.includes("?astro&type=script")) {
          request.url = `/@fs${request.url}`
        }
        next()
      })
    },
  }
}
