import "leaflet/dist/leaflet.css"

import type { Map as LeafletMap } from "leaflet"
import { useEffect, useRef } from "react"

import type { LarmPin } from "@/lib/larm-map"

import { createSiteMap, loadLeaflet, tooltipText, untabLinks } from "./map-setup"

/**
 * A larm where it was reported, on the larm's own page (docs/design.md, "Larm
 * på kartan").
 *
 * The site has published a larm's exact position since 2026-11-14. This
 * island draws it, and is as narrow as the lokal map: it takes
 * {@link LarmPin}s built on the server by `larm-map.ts` from DTOs that
 * `alert-place.ts` already decided on — a point, an id, a species, a rarity.
 * It never imports the larm read path; `secret-key-scope.test.ts` fails any
 * `.tsx` that does.
 *
 * It is a still: the fynd, and the lokal its place label names as a ring with
 * the name set beside it, like an atlas. No gestures. Like the lokal map it is
 * `aria-hidden` with its links out of the tab order; the page's "Plats" says
 * the same thing in text, and links to the exact point on OpenStreetMap.
 */

export type LarmMapLokal = { name: string; latitude: number; longitude: number }

type Props = {
  pins: LarmPin[]
  /** The lokal the larm's place label names. */
  lokal?: LarmMapLokal | null
}

/** The fynd alone: close enough to see the field edge and the path. */
const STILL_ZOOM = 14
/** The fynd and its lokal: never closer than this, so the two stay a pair. */
const MAX_ZOOM = 15
/** A fynd: larger than a lokal's dot, so the two never read as the same thing. */
const FYND_RADIUS = 7

export default function LarmMap({ pins, lokal = null }: Props) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = container.current
    if (!element) return

    let map: LeafletMap | null = null
    let cancelled = false

    void (async () => {
      const L = await loadLeaflet()
      if (cancelled) return

      map = createSiteMap(L, element, { still: true }).map

      // The lokal under the fynd, so it draws first: a hollow ring with its
      // name as a permanent label. It answers "near what?" at a glance.
      if (lokal) {
        L.circleMarker([lokal.latitude, lokal.longitude], {
          className: "lokal-ref",
          radius: 9,
          interactive: false,
        })
          .bindTooltip(tooltipText(lokal.name), {
            permanent: true,
            direction: "right",
            offset: [10, 0],
            className: "map-label",
          })
          .addTo(map)
      }

      for (const pin of pins) {
        L.circleMarker([pin.latitude, pin.longitude], {
          className: pin.rare ? "larm-pin larm-pin--rare" : "larm-pin",
          radius: FYND_RADIUS,
          interactive: false,
        }).addTo(map)
      }

      const first = pins[0]
      if (first && lokal) {
        map.fitBounds(
          L.latLngBounds([
            [first.latitude, first.longitude],
            [lokal.latitude, lokal.longitude],
          ]),
          { padding: [40, 40], maxZoom: MAX_ZOOM, animate: false }
        )
      } else if (first) {
        map.setView([first.latitude, first.longitude], STILL_ZOOM, { animate: false })
      } else if (lokal) {
        map.setView([lokal.latitude, lokal.longitude], STILL_ZOOM, { animate: false })
      }

      untabLinks(element)
    })()

    return () => {
      cancelled = true
      map?.remove()
    }
  }, [pins, lokal])

  return <div ref={container} className="h-full w-full" aria-hidden="true" />
}
