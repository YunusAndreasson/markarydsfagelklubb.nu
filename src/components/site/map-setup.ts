import type { LatLngExpression, Map as LeafletMap, MapOptions, Polygon } from "leaflet"

import boundary from "@/data/markaryd-boundary.json"

/**
 * What every map on the site shares: the tiles, the kommun's outline, the
 * motion and scroll manners, and the tooltip text (docs/design.md, "Lokaler").
 *
 * **Leaflet is loaded here, inside a function, never at a module's top.** It
 * reads `window` while its module body runs, and an `.astro` page importing an
 * island pulls the island into the Worker bundle even under `client:visible` —
 * which fails the route with `window is not defined` rather than degrading.
 * Calling {@link loadLeaflet} from an effect keeps it strictly in the browser.
 *
 * Nothing here knows about larm or lokaler; the islands bring their own marks.
 */

export type Leaflet = typeof import("leaflet")

export async function loadLeaflet(): Promise<Leaflet> {
  return (await import("leaflet")).default
}

/** Standard OpenStreetMap raster tiles. The host is in the CSP's `img-src`. */
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

/** Room around the marks so none of them sits against the frame. */
export const FIT_PADDING: [number, number] = [28, 28]

/** The boundary is stored as [lng, lat], the way GeoJSON writes it; Leaflet wants [lat, lng]. */
const boundaryRings: LatLngExpression[][] = (boundary.rings as [number, number][][]).map((ring) =>
  ring.map(([lng, lat]) => [lat, lng] as LatLngExpression)
)

export type SiteMap = { map: LeafletMap; outline: Polygon }

/**
 * A map in the site's manners, with tiles and the kommun drawn.
 *
 * - It never eats the page's scroll: `scrollWheelZoom` is off, the zoom
 *   buttons and pinch-zoom remain.
 * - `still` takes every gesture away: a picture of a place, not a tool.
 * - `keyboard` is off because the map is `aria-hidden`; the page's text is its
 *   accessible equivalent.
 * - Animation follows `prefers-reduced-motion`.
 */
export function createSiteMap(
  L: Leaflet,
  element: HTMLElement,
  { still = false, ...options }: MapOptions & { still?: boolean } = {}
): SiteMap {
  const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const map = L.map(element, {
    scrollWheelZoom: false,
    dragging: !still,
    touchZoom: !still,
    doubleClickZoom: !still,
    boxZoom: !still,
    zoomControl: !still,
    keyboard: false,
    attributionControl: true,
    zoomAnimation: !quiet,
    fadeAnimation: !quiet,
    markerZoomAnimation: !quiet,
    ...options,
  })

  L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(map)

  // The kommun the whole site is about, as a hairline. No fill: it frames
  // the marks and shows which fall outside, without tinting the map.
  const outline = L.polygon(boundaryRings, {
    className: "lokal-boundary",
    fill: false,
    weight: 1.5,
    interactive: false,
  }).addTo(map)

  return { map, outline }
}

/**
 * Leaflet's own zoom and attribution links, out of the tab order: a focusable
 * element must not sit inside an `aria-hidden` subtree. Call it once the
 * controls exist.
 */
export function untabLinks(element: HTMLElement): void {
  for (const link of element.querySelectorAll("a")) link.tabIndex = -1
}

/**
 * Tooltip content as **text**. Leaflet renders a string tooltip as HTML, so a
 * species or lokal name is set with `textContent`, one line per argument, and
 * the first line is the name.
 */
export function tooltipText(...lines: (string | null | undefined | false)[]): HTMLElement {
  const root = document.createElement("span")
  root.className = "map-tip__body"
  for (const [index, line] of lines.filter((value): value is string => Boolean(value)).entries()) {
    const part = document.createElement("span")
    part.className = index === 0 ? "map-tip__name" : "map-tip__line"
    part.textContent = line
    root.appendChild(part)
  }
  return root
}
