import { type Kv, store } from "@/lib/artportalen/store"
import { readObsarKv } from "@/lib/worker-env"

/**
 * The Obsar pages' one door to the statistics. They read what the scheduled
 * jobs wrote to KV and nothing else: no page calls Artportalen, so no visitor
 * waits on it and none can reach the key.
 */
export function obsarStore(): Kv | null {
  const kv = readObsarKv()
  if (!kv) console.error("obsar: server_misconfigured", { problem: "OBSAR KV binding is missing" })
  return kv
}

export { store }

/** The Obsar section's own pages, in the order of the sub-navigation. */
export const OBSAR_PAGES = [
  { href: "/obsar", label: "Översikt" },
  { href: "/obsar/senaste", label: "Senaste fynden" },
  { href: "/obsar/arslista", label: "Årslistan" },
  { href: "/obsar/markarydslistan", label: "Markarydslistan" },
  { href: "/obsar/ligan", label: "Ligan" },
  { href: "/obsar/40-ar", label: "40 år" },
] as const

export const ARTPORTALEN_REPORT_URL = "https://www.artportalen.se/"
