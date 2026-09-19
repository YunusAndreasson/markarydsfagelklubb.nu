import { describe, expect, it } from "vitest"

import {
  buildMenu,
  buildPageTree,
  descendantIds,
  flattenTree,
  isCurrentEntry,
  type PageRow,
  resolvePath,
} from "./page-tree"

let nextId = 1
function row(overrides: Partial<PageRow> & Pick<PageRow, "slug">): PageRow {
  return {
    id: nextId++,
    parent_id: null,
    kind: "page",
    title: overrides.slug,
    link_url: null,
    show_in_menu: true,
    sort_order: 0,
    ...overrides,
  }
}

function siteRows(): PageRow[] {
  nextId = 1
  const klubben = row({ slug: "om-foreningen", title: "Klubben", sort_order: 5 })
  const program = row({ slug: "program", title: "Program", sort_order: 2 })
  return [
    klubben,
    row({ slug: "verksamhet", title: "Verksamhet", parent_id: klubben.id, sort_order: 1 }),
    row({ slug: "medlemskap", title: "Medlemskap", parent_id: klubben.id, sort_order: 2 }),
    row({
      slug: "styrelsen",
      title: "Styrelsen",
      parent_id: klubben.id,
      sort_order: 3,
      show_in_menu: false,
    }),
    program,
    row({ slug: "allmant", title: "Allmänt", parent_id: program.id }),
    row({
      slug: "artiklar",
      title: "Artiklar",
      kind: "link",
      link_url: "/artiklar",
      sort_order: 1,
    }),
    row({
      slug: "artportalen",
      title: "Artportalen",
      kind: "link",
      link_url: "https://www.artportalen.se/",
      sort_order: 9,
    }),
  ]
}

describe("buildPageTree", () => {
  it("gives every page its full path, children in order", () => {
    const tree = buildPageTree(siteRows())
    expect(tree.roots.map((node) => node.path)).toEqual([
      "/artiklar",
      "/program",
      "/om-foreningen",
      "/artportalen",
    ])
    const klubben = tree.roots[2]
    expect(klubben?.children.map((node) => node.path)).toEqual([
      "/om-foreningen/verksamhet",
      "/om-foreningen/medlemskap",
      "/om-foreningen/styrelsen",
    ])
    expect(tree.unreachable).toEqual([])
  })

  it("leaves out pages whose parent the visitor can't see", () => {
    const rows = siteRows().filter((r) => r.slug !== "program")
    const tree = buildPageTree(rows)
    expect(resolvePath(tree, ["program", "allmant"])).toBeNull()
    expect(tree.unreachable).toHaveLength(1)
  })

  it("terminates on a cycle and leaves the cyclic pages out", () => {
    const a = row({ slug: "a", id: 100, parent_id: 101 })
    const b = row({ slug: "b", id: 101, parent_id: 100 })
    const self = row({ slug: "self", id: 102, parent_id: 102 })
    const top = row({ slug: "top", id: 103 })
    const tree = buildPageTree([a, b, self, top])
    expect(tree.roots.map((node) => node.slug)).toEqual(["top"])
    expect(tree.unreachable.sort()).toEqual([100, 101, 102])
  })
})

describe("resolvePath", () => {
  const tree = buildPageTree(siteRows())

  it("finds nested pages, hidden ones included", () => {
    expect(resolvePath(tree, ["om-foreningen", "verksamhet"])?.title).toBe("Verksamhet")
    expect(resolvePath(tree, ["om-foreningen", "styrelsen"])?.title).toBe("Styrelsen")
  })

  it("never serves a link row or a path that doesn't exist", () => {
    expect(resolvePath(tree, ["artiklar"])).toBeNull()
    expect(resolvePath(tree, ["verksamhet"])).toBeNull()
    expect(resolvePath(tree, ["om-foreningen", "verksamhet", "mer"])).toBeNull()
    expect(resolvePath(tree, [])).toBeNull()
  })
})

describe("buildMenu", () => {
  it("lists visible entries with their hrefs, links pointing where they point", () => {
    const menu = buildMenu(buildPageTree(siteRows()))
    expect(menu.map((entry) => [entry.title, entry.href, entry.external])).toEqual([
      ["Artiklar", "/artiklar", false],
      ["Program", "/program", false],
      ["Klubben", "/om-foreningen", false],
      ["Artportalen", "https://www.artportalen.se/", true],
    ])
    expect(menu[2]?.children.map((entry) => entry.title)).toEqual(["Verksamhet", "Medlemskap"])
  })
})

describe("isCurrentEntry", () => {
  const entry = { title: "Klubben", href: "/om-foreningen", external: false, children: [] }

  it("marks the section of the page being viewed", () => {
    expect(isCurrentEntry(entry, "/om-foreningen")).toBe(true)
    expect(isCurrentEntry(entry, "/om-foreningen/verksamhet")).toBe(true)
  })

  it("doesn't match a mere prefix", () => {
    expect(isCurrentEntry(entry, "/om-foreningen-arkiv")).toBe(false)
    expect(isCurrentEntry({ ...entry, href: "/" }, "/program")).toBe(false)
  })
})

describe("descendantIds and flattenTree", () => {
  it("collects everything below a page, and lists pages depth first", () => {
    const tree = buildPageTree(siteRows())
    const klubben = tree.roots[2]
    expect(klubben && [...descendantIds(tree, klubben.id)].length).toBe(3)
    expect(flattenTree(tree).map((node) => `${"  ".repeat(node.depth)}${node.slug}`)).toEqual([
      "artiklar",
      "program",
      "  allmant",
      "om-foreningen",
      "  verksamhet",
      "  medlemskap",
      "  styrelsen",
      "artportalen",
    ])
  })
})
