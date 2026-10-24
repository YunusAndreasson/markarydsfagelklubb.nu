import { describe, expect, it } from "vitest"
import map from "@/data/wp-redirects.json"
import { isValidSlug, RESERVED_ARTICLE_SLUGS, RESERVED_TOP_LEVEL_SLUGS } from "./slug"
import { MOVED_PAGES, normaliseOldPath, wpRedirect } from "./wp-redirects"

const paths = Object.entries(map.paths)
const targets = [...paths.map(([, to]) => to), ...Object.values(map.ids)]

describe("the generated redirect map (D6)", () => {
  it("covers every imported post, and the moved pages", () => {
    // 353 posts, 46 categories, the page moves and the lokal pages.
    expect(paths.length).toBeGreaterThan(400)
    expect(map.paths["/programandring"]).toBe("/artiklar/programandring")
    expect(map.paths["/medlemsskap"]).toBe("/om-foreningen/medlemskap")
    expect(map.paths["/svalan"]).toBe("/obsar")
    expect(map.paths["/fagellokaler/ribersdal"]).toBe("/lokaler/reningsdammarna")
  })

  it("keeps the app's legal links working at the root form", () => {
    // ../mafk-mobie/src/constants/legal.ts; a 404 there is a store rejection.
    for (const slug of [
      "integritetspolicy-markaryds-fagelklubb-appen",
      "anvandarvillkor-markaryds-fagelklubb-appen",
    ]) {
      expect(map.paths[`/${slug}` as keyof typeof map.paths]).toBe(`/om-foreningen/${slug}`)
    }
  })

  it("stores keys the way the lookup normalises them", () => {
    for (const [from] of paths) expect(normaliseOldPath(from), from).toBe(from)
  })

  it("never claims a path under one of the site's own routes", () => {
    for (const [from] of paths) {
      const top = from.split("/")[1] ?? ""
      expect(RESERVED_TOP_LEVEL_SLUGS.has(top), from).toBe(false)
      expect(from.startsWith("/_astro"), from).toBe(false)
    }
  })

  it("points only at the site or at Artportalen, in one hop", () => {
    const keys = new Set(paths.map(([from]) => from))
    for (const to of targets) {
      expect(to.startsWith("/") || to.startsWith("https://www.artportalen.se/"), to).toBe(true)
      expect(to.startsWith("//"), to).toBe(false)
      expect(keys.has(normaliseOldPath(to)), `${to} would redirect again`).toBe(false)
    }
  })

  it("sends articles to a valid article slug", () => {
    for (const to of targets.filter((target) => target.startsWith("/artiklar/"))) {
      const rest = to.slice("/artiklar/".length)
      if (rest.startsWith("kategori/")) continue
      expect(isValidSlug(rest), to).toBe(true)
      expect(RESERVED_ARTICLE_SLUGS.has(rest), to).toBe(false)
    }
  })
})

describe("wpRedirect", () => {
  const none = new URLSearchParams()

  it("finds an old path with or without its slash, in any case", () => {
    expect(wpRedirect("/programandring", none)).toBe("/artiklar/programandring")
    expect(wpRedirect("/programandring/", none)).toBe("/artiklar/programandring")
    expect(wpRedirect("/ProgramAndring", none)).toBe("/artiklar/programandring")
  })

  it("answers WordPress shortlinks on the home page only", () => {
    expect(wpRedirect("/", new URLSearchParams("p=10240"))).toBe("/artiklar/programandring")
    expect(wpRedirect("/", new URLSearchParams("page_id=893"))).toBe("/om-foreningen/medlemskap")
    expect(wpRedirect("/", new URLSearchParams("p=abc"))).toBeNull()
    expect(wpRedirect("/", none)).toBeNull()
    expect(wpRedirect("/artiklar", new URLSearchParams("p=10240"))).toBeNull()
  })

  it("sends the pages folded into Klubben there, and old URLs for them in one hop", () => {
    expect(wpRedirect("/om-foreningen/verksamhet", none)).toBe("/om-foreningen")
    expect(wpRedirect("/om-foreningen/allmant/", none)).toBe("/om-foreningen")
    expect(wpRedirect("/program/allmant", none)).toBe("/om-foreningen")
    expect(wpRedirect("/", new URLSearchParams("page_id=891"))).toBe("/om-foreningen")
    for (const target of Object.values(MOVED_PAGES)) {
      expect(MOVED_PAGES[target], target).toBeUndefined()
    }
  })

  it("leaves everything else alone", () => {
    expect(wpRedirect("/finns-inte", none)).toBeNull()
    expect(wpRedirect("/%E0%A4%A", none)).toBeNull()
  })
})
