import "leaflet/dist/leaflet.css"

import type { DivIcon, LatLngExpression, Map as LeafletMap } from "leaflet"
import { useEffect, useRef } from "react"

import boundary from "@/data/markaryd-boundary.json"
import type { LokalPin } from "@/lib/lokal"

/**
 * The club's lokaler on a map (docs/design.md, "Lokaler").
 *
 * The site's **first public island**, and deliberately the narrowest one that
 * can exist: it takes an array of place names and positions, draws them, and
 * navigates on a click. It holds no larm, no observer and no coordinate that
 * isn't the club's own — `secret-key-scope.test.ts` fails any `.tsx` that
 * reaches the larm read path, and the props below are the whole contract.
 *
 * The register below the map is the accessible equivalent: every lokal, in
 * order, as ordinary links. So the markers are not focusable and the container
 * is `aria-hidden`, which keeps 61 tab stops out of the way of a keyboard user
 * and keeps a focusable element from sitting inside a hidden subtree. Change
 * one of those and you have to change the other.
 *
 * **Leaflet is imported inside the effect, not at the top of the file.** It
 * reads `window` while its module body runs, and an `.astro` page importing
 * this component pulls it into the Worker bundle even under `client:visible` —
 * which fails the route with `window is not defined` rather than degrading.
 * The dynamic import keeps it strictly in the browser, and keeps the island
 * deferred until the map scrolls into view.
 */

type Props = {
  pins: LokalPin[]
  /**
   * A still picture of one place, for a lokal's own page: no dragging, no
   * zooming, no navigating. The map answers "where is this" and nothing else.
   */
  still?: boolean
}

/** Standard OpenStreetMap raster tiles. The host is in the CSP's `img-src`. */
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

/** Room around the pins so none of them sits against the frame. */
const FIT_PADDING: [number, number] = [28, 28]
/** How close a single-pin still sits. Zoom 14 shows the lokal and its approach roads. */
const STILL_ZOOM = 14

/** The boundary is stored as [lng, lat], the way GeoJSON writes it; Leaflet wants [lat, lng]. */
const boundaryRings: LatLngExpression[][] = (boundary.rings as [number, number][][]).map((ring) =>
  ring.map(([lng, lat]) => [lat, lng] as LatLngExpression)
)

export default function LokalMap({ pins, still = false }: Props) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = container.current
    if (!element) return

    let map: LeafletMap | null = null
    let cancelled = false

    void (async () => {
      const L = (await import("leaflet")).default
      if (cancelled) return

      const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches

      /**
       * A dot, not a teardrop. Leaflet's default pin is a recognisable piece
       * of someone else's design; this is a 9 px circle in the site's own
       * tokens, with a paper-coloured ring so it stays visible over water,
       * forest and road alike.
       */
      const dot = (pin: LokalPin): DivIcon =>
        L.divIcon({
          className: "lokal-pin",
          html: `<span class="lokal-pin__dot${pin.active ? " lokal-pin__dot--active" : ""}"></span>`,
          iconSize: [13, 13],
          iconAnchor: [6.5, 6.5],
        })

      map = L.map(element, {
        // A map that swallows the page's scroll is a bug on a reading page;
        // the zoom buttons and pinch-zoom still work.
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
      })

      L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(map)

      // The kommun the whole site is about, as a hairline. No fill: it frames
      // the pins and shows which lokaler fall outside, without tinting the map.
      const outline = L.polygon(boundaryRings, {
        className: "lokal-boundary",
        fill: false,
        weight: 1.5,
        interactive: false,
      }).addTo(map)

      for (const pin of pins) {
        const marker = L.marker([pin.latitude, pin.longitude], {
          icon: dot(pin),
          keyboard: false,
          title: pin.name,
          interactive: !still,
        })
        if (!still) {
          marker.bindTooltip(pin.name, {
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

      const first = pins[0]
      if (still && first) {
        map.setView([first.latitude, first.longitude], STILL_ZOOM)
      } else if (pins.length > 0) {
        map.fitBounds(L.latLngBounds(pins.map((pin) => [pin.latitude, pin.longitude])), {
          padding: FIT_PADDING,
          animate: false,
        })
      } else {
        map.fitBounds(outline.getBounds(), { padding: FIT_PADDING, animate: false })
      }
    })()

    return () => {
      cancelled = true
      map?.remove()
    }
  }, [pins, still])

  return <div ref={container} className="h-full w-full" aria-hidden="true" />
}
