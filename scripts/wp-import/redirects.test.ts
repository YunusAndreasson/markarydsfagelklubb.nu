import { describe, expect, it } from "vitest"
import { flattenTree, PAGE_TREE } from "./page-tree"
import { buildRedirects } from "./redirects"

const WP = "https://markarydsfagelklubb.nu"

describe("buildRedirects", () => {
  const built = buildRedirects({
    posts: [{ id: 10240, slug: "programandring", link: `${WP}/programandring/` }],
    categories: [
      { slug: "smalandsrallyt", link: `${WP}/category/smalandsrallyt/` },
      { slug: "okategoriserade", link: `${WP}/category/okategoriserade/` },
    ],
  })

  it("sends a post to its article, by path and by id", () => {
    expect(built.paths["/programandring"]).toBe("/artiklar/programandring")
    expect(built.ids["10240"]).toBe("/artiklar/programandring")
  })

  it("sends a category to the site category it was mapped onto", () => {
    expect(built.paths["/category/smalandsrallyt"]).toBe("/artiklar/kategori/tavlingar")
    expect(built.paths["/category/okategoriserade"]).toBe("/artiklar")
  })

  it("sends a moved page to its place in the tree, and a link entry to its target", () => {
    expect(built.paths["/klubbtavlingar/vinterfagelrally"]).toBe(
      "/om-foreningen/tavlingar/vinterfagelrally"
    )
    expect(built.paths["/program/program-2013"]).toBe("/kalender")
    expect(built.paths["/svalan/blekinge"]).toBe(
      "https://www.artportalen.se/search/sightings/area/1"
    )
  })

  it("refuses one old path pointing two ways", () => {
    expect(() =>
      buildRedirects({
        posts: [{ id: 1, slug: "svalan", link: `${WP}/svalan/` }],
        categories: [],
      })
    ).toThrow(/both/)
  })
})

describe("the page tree", () => {
  it("has unique paths and valid slugs", () => {
    const all = flattenTree()
    expect(new Set(all.map(({ path }) => path)).size).toBe(all.length)
    for (const { entry } of all) expect(entry.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it("has the six signed-off sections, in order", () => {
    expect(PAGE_TREE.map((entry) => entry.title)).toEqual([
      "Artiklar",
      "Larm",
      "Program",
      "Obsar",
      "Lokaler",
      "Klubben",
    ])
  })
})
