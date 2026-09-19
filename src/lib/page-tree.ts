/**
 * The page tree (docs/roadmap.md, F1 and D6): one table gives both the URLs of
 * the pages and the site's menu.
 *
 * Built on every public request from a flat list of rows, so it must be cheap
 * and must terminate whatever the data says. A row whose parent chain never
 * reaches the top is left out: it is either an orphan (its parent is a draft,
 * so the visitor can't see it) or part of a cycle (a bad parent_id). Neither
 * may take every page down with it.
 */

export type PageRow = {
  id: number
  parent_id: number | null
  kind: "page" | "link"
  slug: string
  title: string
  link_url: string | null
  show_in_menu: boolean
  sort_order: number
}

export type PageNode = PageRow & {
  /** "/om-foreningen/verksamhet". For a link row, where it would sit; nothing is served there. */
  path: string
  depth: number
  children: PageNode[]
}

export type PageTree = {
  roots: PageNode[]
  byId: ReadonlyMap<number, PageNode>
  /** Ids that are unreachable from the top: orphans and cycles. */
  unreachable: number[]
}

function bySortOrder(a: PageRow, b: PageRow): number {
  return a.sort_order - b.sort_order || a.title.localeCompare(b.title, "sv") || a.id - b.id
}

export function buildPageTree(rows: readonly PageRow[]): PageTree {
  const childrenOf = new Map<number | null, PageRow[]>()
  for (const row of rows) {
    const siblings = childrenOf.get(row.parent_id) ?? []
    siblings.push(row)
    childrenOf.set(row.parent_id, siblings)
  }

  const byId = new Map<number, PageNode>()

  // Walks down from the top only, so a cycle can never be entered, and the
  // visited set guards against a row id appearing twice.
  const build = (parent: PageNode | null): PageNode[] => {
    const rowsHere = [...(childrenOf.get(parent?.id ?? null) ?? [])].sort(bySortOrder)
    const nodes: PageNode[] = []
    for (const row of rowsHere) {
      if (byId.has(row.id)) continue
      const node: PageNode = {
        ...row,
        path: `${parent?.path ?? ""}/${row.slug}`,
        depth: parent ? parent.depth + 1 : 0,
        children: [],
      }
      byId.set(row.id, node)
      // Links have no pages below them.
      if (row.kind === "page") node.children = build(node)
      nodes.push(node)
    }
    return nodes
  }

  const roots = build(null)
  const unreachable = rows.filter((row) => !byId.has(row.id)).map((row) => row.id)
  return { roots, byId, unreachable }
}

/** The page at `/segment/segment/…`, or null. Link rows are never served. */
export function resolvePath(tree: PageTree, segments: readonly string[]): PageNode | null {
  if (segments.length === 0) return null
  let level = tree.roots
  let found: PageNode | null = null
  for (const segment of segments) {
    found = level.find((node) => node.kind === "page" && node.slug === segment) ?? null
    if (!found) return null
    level = found.children
  }
  return found
}

export type MenuEntry = {
  title: string
  href: string
  /** Leaves the site: an absolute http(s) or mailto link. */
  external: boolean
  children: MenuEntry[]
}

function hrefOf(node: PageNode): string {
  return node.kind === "link" ? (node.link_url ?? "/") : node.path
}

function toMenuEntry(node: PageNode): MenuEntry {
  const href = hrefOf(node)
  return {
    title: node.title,
    href,
    external: !href.startsWith("/"),
    children: node.children.filter((child) => child.show_in_menu).map(toMenuEntry),
  }
}

/** The menu: every visible entry, in order, with its visible children. */
export function buildMenu(tree: PageTree): MenuEntry[] {
  return tree.roots.filter((node) => node.show_in_menu).map(toMenuEntry)
}

/** True when `pathname` is this entry's page or below it. */
export function isCurrentEntry(entry: MenuEntry, pathname: string): boolean {
  if (entry.external || entry.href === "/") return entry.href === pathname
  return pathname === entry.href || pathname.startsWith(`${entry.href}/`)
}

/** The ids of every page below `id`, which can't become its parent. */
export function descendantIds(tree: PageTree, id: number): Set<number> {
  const found = new Set<number>()
  const stack = [...(tree.byId.get(id)?.children ?? [])]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node || found.has(node.id)) continue
    found.add(node.id)
    stack.push(...node.children)
  }
  return found
}

/** Every node, depth first in menu order: the admin's page list. */
export function flattenTree(tree: PageTree): PageNode[] {
  const out: PageNode[] = []
  const visit = (nodes: PageNode[]) => {
    for (const node of nodes) {
      out.push(node)
      visit(node.children)
    }
  }
  visit(tree.roots)
  return out
}
