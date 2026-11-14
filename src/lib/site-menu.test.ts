import { describe, expect, it } from "vitest"

import { OBSAR_PAGES } from "./obsar"
import { buildPageTree, type PageRow } from "./page-tree"
import { buildSiteMenu, isCurrentChild, SITE_FALLBACK_MENU } from "./site-menu"

let nextId = 1
function row(overrides: Partial<PageRow> & Pick<PageRow, "slug">): PageRow {
  return {
    id: nextId++,
    parent_id: null,
    kind: "page",
    title: overrides.slug,
    link_url: null,
    show_in_menu: true,
    sort_order: nextId,
    ...overrides,
  }
}

function link(slug: string, title: string, url: string, parent_id: number | null = null): PageRow {
  return row({ slug, title, kind: "link", link_url: url, parent_id })
}

/** The live tree's shape: the Obsar links are still the WordPress ones. */
function liveRows(): PageRow[] {
  nextId = 1
  const obsar = row({ slug: "obsar", title: "Obsar" })
  const klubben = row({ slug: "om-foreningen", title: "Klubben" })
  return [
    link("artiklar", "Artiklar", "/artiklar"),
    link("larm", "Larm", "/larm"),
    obsar,
    link("rapportera", "Rapportera på Artportalen", "https://www.artportalen.se/", obsar.id),
    link("kommunobservationer", "Kommunobservationer", "https://artportalen.se/x", obsar.id),
    link("arslista", "Årslista 2026", "https://artportalen.se/y", obsar.id),
    link("halland", "Halland", "https://artportalen.se/halland", obsar.id),
    klubben,
    row({ slug: "medlemskap", title: "Medlemskap", parent_id: klubben.id }),
    row({ slug: "cinclus", title: "Cinclus", parent_id: klubben.id }),
  ]
}

function section(menu: ReturnType<typeof buildSiteMenu>, title: string) {
  const found = menu.find((entry) => entry.title === title)
  if (!found) throw new Error(`no ${title}`)
  return found
}

describe("buildSiteMenu", () => {
  const menu = buildSiteMenu(buildPageTree(liveRows()))

  it("lists Obsar's own pages, then reporting and the regions, never the old kommun links", () => {
    const obsar = section(menu, "Obsar")
    expect(obsar.children.map((child) => [child.title, child.group, child.external])).toEqual([
      ...OBSAR_PAGES.map((page) => [page.label, undefined, false]),
      ["Rapportera på Artportalen", "Har du sett något?", true],
      ["Halland", "Runt omkring", true],
    ])
    expect(obsar.children[0]?.description).toBeTruthy()
    expect(obsar.description).toBeTruthy()
  })

  it("gives Artiklar no list: its categories are tabs on its own page", () => {
    expect(section(menu, "Artiklar").children).toEqual([])
  })

  it("leads Klubben with its own page", () => {
    expect(section(menu, "Klubben").children.map((child) => child.href)).toEqual([
      "/om-foreningen",
      "/om-foreningen/medlemskap",
      "/om-foreningen/cinclus",
    ])
  })

  it("leaves sections without pages beneath them alone", () => {
    expect(section(menu, "Larm").children).toEqual([])
    expect(section(menu, "Larm").description).toBeUndefined()
  })
})

describe("SITE_FALLBACK_MENU", () => {
  it("still has Obsar's own pages, which need no query", () => {
    expect(section(SITE_FALLBACK_MENU, "Obsar").children.map((child) => child.href)).toEqual(
      OBSAR_PAGES.map((page) => page.href)
    )
    expect(section(SITE_FALLBACK_MENU, "Klubben").children).toEqual([])
  })
})

describe("isCurrentChild", () => {
  const obsar = section(SITE_FALLBACK_MENU, "Obsar")
  const [overview, , arslista] = obsar.children
  if (!overview || !arslista) throw new Error("fixture")

  it("marks the section's own page only on itself", () => {
    expect(isCurrentChild(overview, obsar, "/obsar")).toBe(true)
    expect(isCurrentChild(overview, obsar, "/obsar/ligan")).toBe(false)
  })

  it("marks a page with years below it on every year", () => {
    expect(isCurrentChild(arslista, obsar, "/obsar/arslista/2019")).toBe(true)
  })
})
