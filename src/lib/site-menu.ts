import { groupObsar, OBSAR_PAGES, obsarDescription } from "./obsar"
import {
  buildMenu,
  FALLBACK_MENU,
  hrefOf,
  isCurrentEntry,
  type MenuEntry,
  type PageNode,
  type PageTree,
} from "./page-tree"

/**
 * The header's menu (docs/design.md, "Header"): the page tree's top level, with
 * the pages beneath each section that the header's panels and the phone menu
 * list. Two sections are filled from more than the tree:
 *
 * - **Obsar** lists the site's own statistics pages, which live in code. The
 *   tree's kommun links under Obsar predate them and still point at
 *   Artportalen, so only its *Rapportera* and region links are kept, after the
 *   site's own pages.
 * - **Klubben** starts with its own page, since the panel replaces the click
 *   that used to land there.
 *
 * Every section page is still the first entry of its own list, so the panel is
 * a shortcut and never the only way to the section.
 *
 * Artiklar has no list: its categories filter the article list, so they are
 * tabs on that page, and listing them here too repeated them (2026-11-15). The
 * header chooses a page; the page's own controls change what it shows.
 */

const OBSAR = "/obsar"
const CLUB = "/om-foreningen"

const LEADS: Readonly<Record<string, string>> = {
  [OBSAR]: "Det som rapporteras i Markaryds kommun, hämtat från Artportalen.",
  [CLUB]: "Föreningen, medlemskapet och det klubben gör för fåglarna.",
}

function entry(title: string, href: string, extra: Partial<MenuEntry> = {}): MenuEntry {
  return { title, href, external: !href.startsWith("/"), children: [], ...extra }
}

type ObsarNode = PageNode & { description?: string }

function obsarChildren(node: ObsarNode | undefined): MenuEntry[] {
  const own = OBSAR_PAGES.map((page) =>
    entry(page.label, page.href, { description: page.description })
  )
  if (!node) return own
  const { report, regions } = groupObsar(
    node.children.filter((child) => child.show_in_menu) as ObsarNode[]
  )
  return [
    ...own,
    ...report.map((child) =>
      entry(child.title, hrefOf(child), {
        group: "Har du sett något?",
        description: obsarDescription(child),
      })
    ),
    ...regions.map((child) => entry(child.title, hrefOf(child), { group: "Runt omkring" })),
  ]
}

/** Fills the two sections' lists; every other entry passes through. */
export function withSections(menu: readonly MenuEntry[], tree: PageTree | null): MenuEntry[] {
  return menu.map((top) => {
    if (top.external) return top
    if (top.href === OBSAR) {
      const node = tree?.roots.find((root) => root.kind === "page" && root.slug === "obsar")
      return { ...top, description: LEADS[OBSAR], children: obsarChildren(node) }
    }
    if (top.href === CLUB && top.children.length > 0) {
      return {
        ...top,
        description: LEADS[CLUB],
        children: [entry("Om klubben", CLUB), ...top.children],
      }
    }
    return top
  })
}

export function buildSiteMenu(tree: PageTree): MenuEntry[] {
  return withSections(buildMenu(tree), tree)
}

/**
 * For the pages that can't read the tree (the prerendered 404 and legal pages,
 * or a failed read): the fixed top level, with Obsar's own pages, which need
 * no query.
 */
export const SITE_FALLBACK_MENU: MenuEntry[] = withSections(FALLBACK_MENU, null)

/**
 * A child is the page being viewed. The section's own page, first in its list,
 * matches only itself, or it would be marked on every page of the section.
 */
export function isCurrentChild(child: MenuEntry, parent: MenuEntry, pathname: string): boolean {
  if (child.href === parent.href) return pathname === child.href
  return isCurrentEntry(child, pathname)
}
