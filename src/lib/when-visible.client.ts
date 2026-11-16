/**
 * Runs `start` once, when `element` comes near the viewport: what Astro's
 * `client:visible` did for the map and chart islands, without React. Those
 * islands only ran one effect, so shipping React to draw them was all cost
 * (2026-11-17).
 *
 * `*.client.ts` modules run in the browser only. The key-scope tests hold them
 * to the same rule as a `.tsx` island: no larm read path, no key.
 */
export function whenVisible(element: Element, start: () => void): void {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect()
        start()
      }
    },
    // A little ahead of the fold, so the tiles or the chart are on their way
    // before the box is in view.
    { rootMargin: "200px" }
  )
  observer.observe(element)
}

/** The JSON a frame put in `data-props`, or null if there is none. */
export function propsOf<T>(element: HTMLElement): T | null {
  const raw = element.dataset.props
  return raw ? (JSON.parse(raw) as T) : null
}
