// @ts-check

import cloudflare from "@astrojs/cloudflare"
import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"

// https://astro.build/config
export default defineConfig({
  // Static by default: public pages prerender to plain assets that Cloudflare
  // serves without invoking the Worker. `/admin/*` and `/api/*` opt out per
  // route with `export const prerender = false`. (`output: 'hybrid'` was
  // removed from Astro — this is the current model.)
  output: "static",
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
