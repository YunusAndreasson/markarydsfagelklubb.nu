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
  adapter: cloudflare({
    // Optimise images with sharp at build time for prerendered pages, and pass
    // them through untouched at runtime. The default ("cloudflare-binding")
    // adds a billable Images binding. Revisit when articles bring uploads.
    imageService: "compile",
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
})
