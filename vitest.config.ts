import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Deliberately standalone rather than Astro's `getViteConfig()`: the tests
// cover pure modules, and loading the Astro config would drag the Cloudflare
// adapter (and `cloudflare:workers`) into a plain Node test run.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
