/**
 * Names for cross-document view transitions (docs/design.md, "Lupen"): a photo
 * in a list and the same photo on its own page share a name, and the browser
 * moves one into the other.
 *
 * A name may appear only once on a page, or the browser skips the whole
 * transition. The same article can show twice on one page (the home page's lead
 * and a tile, a list and "Mer i"), so the first to ask gets the name and the
 * rest get none. `taken` lives for one request (`Astro.locals`). The class
 * lets global.css time and fit every photo's move at once.
 */
export type TransitionKind = "artikel" | "larm"

export function transitionName(
  taken: Set<string>,
  kind: TransitionKind,
  id: string | number
): string | undefined {
  // Names are custom idents: letters, digits, "-" and "_" only.
  const name = `${kind}-${String(id).replace(/[^\w-]/g, "_")}`
  if (taken.has(name)) return undefined
  taken.add(name)
  return `view-transition-name: ${name}; view-transition-class: photo`
}

/** The request's set of names already given out, created by the first list to ask. */
export function takenTransitionNames(locals: { transitionNames?: Set<string> }): Set<string> {
  locals.transitionNames ??= new Set()
  return locals.transitionNames
}
