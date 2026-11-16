import type { DivIcon } from "leaflet"

import type { LokalPin } from "@/lib/lokal"
import { type MapPoint, pointsToFrame } from "@/lib/lokal-points"
import { propsOf, whenVisible } from "@/lib/when-visible.client"

import { createSiteMap, FIT_PADDING, loadLeaflet, tooltipText, untabLinks } from "./map-setup"

/**
 * The club's lokaler on a map (docs/design.md, "Lokaler").
 *
 * Deliberately narrow: it takes place names and positions, draws them, and
 * navigates on a click. It holds no larm and no observer; the only larm data it
 * sees is an active lokal's recent species names. `secret-key-scope.test.ts`
 * fails any browser module that reaches the larm read path, and
 * {@link LokalMapProps} is the whole contract.
 *
 * The register below the map is the accessible equivalent: every lokal, in
 * order, as ordinary links. So the markers are not focusable and the container
 * is `aria-hidden`, which keeps 61 tab stops out of a keyboard user's way.
 * Leaflet's own zoom and attribution links get `tabindex="-1"` below, since a
 * focusable element must not sit inside a hidden subtree. Change one of those
 * and you have to change the other.
 *
 * An active lokal's tooltip names the birds larmed from it lately ("Nyss:
 * kungsfiskare, storskrake"); the register prints the same line, so the map
 * says nothing the page doesn't.
 */

export type LokalMapProps = {
  pins: LokalPin[]
  /**
   * A still picture of one place, for a lokal's own page: no dragging, no
   * zooming, no navigating. The map answers "where is this" and nothing else.
   */
  still: boolean
  /** A lokal's numbered places, on its own page, keyed to the list under the map. */
  points: MapPoint[]
}

/** How close a single-pin still sits. Zoom 14 shows the lokal and its approach roads. */
const STILL_ZOOM = 14

/** "kungsfiskare, storskrake": lower case, as the band writes species in a sentence. */
const recentLine = (species: readonly string[]) =>
  species.map((name) => name.toLocaleLowerCase("sv")).join(", ")

export function mountLokalMaps(): void {
  for (const element of document.querySelectorAll<HTMLElement>("[data-lokal-map]")) {
    const props = propsOf<LokalMapProps>(element)
    if (props) whenVisible(element, () => void draw(element, props))
  }
}

async function draw(element: HTMLElement, { pins, still, points }: LokalMapProps): Promise<void> {
  const L = await loadLeaflet()

  /**
   * A dot, not a teardrop. Leaflet's default pin is a recognisable piece of
   * someone else's design; this is a 9 px circle in the site's own tokens, with
   * a paper-coloured ring so it stays visible over water, forest and road
   * alike. A lokal with recent larm is larger as well as green, so the
   * difference isn't colour alone. The icon is wider than the dot to give a
   * finger something to hit.
   */
  const dot = (pin: LokalPin): DivIcon =>
    L.divIcon({
      className: "lokal-pin",
      html: `<span class="lokal-pin__dot${pin.active ? " lokal-pin__dot--active" : ""}"></span>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    })

  const { map, outline } = createSiteMap(L, element, { still })

  for (const pin of pins) {
    const marker = L.marker([pin.latitude, pin.longitude], {
      icon: dot(pin),
      keyboard: false,
      title: pin.name,
      interactive: !still,
    })
    if (!still) {
      const recent = pin.recentSpecies.length > 0 ? `Nyss: ${recentLine(pin.recentSpecies)}` : null
      marker.bindTooltip(tooltipText(pin.name, recent), {
        direction: "top",
        offset: [0, -8],
        className: "lokal-tip",
      })
      marker.on("click", () => {
        window.location.href = `/lokaler/${pin.slug}`
      })
    }
    marker.addTo(map)
  }

  for (const point of points) {
    const marker = L.marker([point.latitude, point.longitude], {
      icon: L.divIcon({
        className: "lokal-point",
        html: `<span class="lokal-point__mark">${point.number}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
      keyboard: false,
      title: point.name,
    })
    marker.bindTooltip(tooltipText(point.name), {
      direction: "top",
      offset: [0, -12],
      className: "lokal-tip",
    })
    marker.on("click", () => {
      window.location.href = point.href
    })
    marker.addTo(map)
  }

  const first = pins[0]
  if (first && points.length > 0) {
    const framed = pointsToFrame(points, first)
    map.fitBounds(
      L.latLngBounds([
        [first.latitude, first.longitude],
        ...framed.map((point): [number, number] => [point.latitude, point.longitude]),
      ]),
      { padding: FIT_PADDING, animate: false, maxZoom: 17 }
    )
  } else if (still && first) {
    map.setView([first.latitude, first.longitude], STILL_ZOOM)
  } else if (pins.length > 0) {
    map.fitBounds(L.latLngBounds(pins.map((pin) => [pin.latitude, pin.longitude])), {
      padding: FIT_PADDING,
      animate: false,
    })
  } else {
    map.fitBounds(outline.getBounds(), { padding: FIT_PADDING, animate: false })
  }

  untabLinks(element)
}
