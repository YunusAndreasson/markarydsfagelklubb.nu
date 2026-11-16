import type { LarmPin } from "@/lib/larm-map"
import { propsOf, whenVisible } from "@/lib/when-visible.client"

import { createSiteMap, loadLeaflet, untabLinks } from "./map-setup"

/**
 * A larm where it was reported, on the larm's own page, or every larm of one
 * bird on its species page (docs/design.md, "Larm på kartan").
 *
 * The site has published a larm's exact position since 2026-11-14. This draws
 * it, and is as narrow as the lokal map: it takes {@link LarmPin}s built on the
 * server by `larm-map.ts` from DTOs that `alert-place.ts` already decided on (a
 * point, an id, a species, a rarity). It never imports the larm read path;
 * `secret-key-scope.test.ts` fails any browser module that does.
 *
 * It is a still: the fynd, and the lokal its place label names as a ring. No
 * gestures. Like the lokal map it is `aria-hidden` with its links out of the
 * tab order; the page's "Plats" says the same thing in text, and links to the
 * exact point on OpenStreetMap.
 */

export type LarmMapLokal = { name: string; latitude: number; longitude: number }

export type LarmMapProps = {
  pins: LarmPin[]
  /** The lokal the larm's place label names. */
  lokal: LarmMapLokal | null
}

/** The fynd alone: close enough to see the field edge and the path. */
const STILL_ZOOM = 14
/** The fynd and its lokal: never closer than this, so the two stay a pair. */
const MAX_ZOOM = 15
/** A fynd: larger than a lokal's dot, so the two never read as the same thing. */
const FYND_RADIUS = 7

export function mountLarmMaps(): void {
  for (const element of document.querySelectorAll<HTMLElement>("[data-larm-map]")) {
    const props = propsOf<LarmMapProps>(element)
    if (props) whenVisible(element, () => void draw(element, props))
  }
}

async function draw(element: HTMLElement, { pins, lokal }: LarmMapProps): Promise<void> {
  const L = await loadLeaflet()
  const { map, outline } = createSiteMap(L, element, { still: true })

  // The lokal under the fynd, so it draws first: a hollow ring. Unlabelled,
  // since "Plats" right above the map names it and the tiles often print the
  // same name; a label of our own doubled it.
  if (lokal) {
    L.circleMarker([lokal.latitude, lokal.longitude], {
      className: "lokal-ref",
      radius: 9,
      interactive: false,
    }).addTo(map)
  }

  for (const pin of pins) {
    L.circleMarker([pin.latitude, pin.longitude], {
      className: pin.rare ? "larm-pin larm-pin--rare" : "larm-pin",
      radius: FYND_RADIUS,
      interactive: false,
    }).addTo(map)
  }

  const first = pins[0]
  if (pins.length > 1) {
    // A species page: every larm of one bird. Frame the ones in and around the
    // kommun; a larm from Malmö or Dublin stays off the frame rather than
    // zooming the map out to half of Europe.
    const near = outline.getBounds().pad(0.5)
    const points = pins
      .map((pin): [number, number] => [pin.latitude, pin.longitude])
      .filter((point) => near.contains(point))
    map.fitBounds(
      L.latLngBounds(points.length > 0 ? points : pins.map((pin) => [pin.latitude, pin.longitude])),
      { paddingTopLeft: [32, 32], paddingBottomRight: [32, 48], maxZoom: MAX_ZOOM, animate: false }
    )
  } else if (first && lokal) {
    map.fitBounds(
      L.latLngBounds([
        [first.latitude, first.longitude],
        [lokal.latitude, lokal.longitude],
      ]),
      // More room at the bottom: the attribution strip sits there.
      { paddingTopLeft: [48, 48], paddingBottomRight: [48, 64], maxZoom: MAX_ZOOM, animate: false }
    )
  } else if (first) {
    map.setView([first.latitude, first.longitude], STILL_ZOOM, { animate: false })
  } else if (lokal) {
    map.setView([lokal.latitude, lokal.longitude], STILL_ZOOM, { animate: false })
  }

  untabLinks(element)
}
