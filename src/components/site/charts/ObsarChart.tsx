import { useEffect, useRef } from "react"
import type { ChartData } from "@/lib/charts/options"

/**
 * One Obsar figure, drawn by ECharts over the server's SVG once the island is
 * on screen (`client:visible`). The wrapper, `ChartFigure.astro`, owns the box
 * and the caption; this only fills the box and then marks it ready, which hides
 * the SVG underneath. Nothing here can reach the API or its key.
 */
export default function ObsarChart({ chart }: { chart: ChartData }) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = box.current
    if (!element) return
    let disposed = false
    let cleanup = () => {}

    ;(async () => {
      // Effects never run on the server; the guard lets the SSR build drop
      // ECharts entirely instead of bundling it into the Worker.
      if (import.meta.env.SSR) return
      const [{ init }, { buildOption }] = await Promise.all([
        import("@/lib/charts/echarts-setup"),
        import("@/lib/charts/options"),
      ])
      if (disposed) return
      const motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      const instance = init(element, undefined, { renderer: "canvas" })
      const isNarrow = () => element.clientWidth < 480
      let narrow = isNarrow()
      instance.setOption(buildOption(chart, motion, narrow))
      element.closest<HTMLElement>("[data-chart]")?.setAttribute("data-ready", "")
      // A phone turned sideways crosses the threshold: rebuild, don't just stretch.
      const observer = new ResizeObserver(() => {
        if (isNarrow() !== narrow) {
          narrow = isNarrow()
          instance.setOption(buildOption(chart, false, narrow), { notMerge: true })
        }
        instance.resize()
      })
      observer.observe(element)
      cleanup = () => {
        observer.disconnect()
        instance.dispose()
      }
    })()

    return () => {
      disposed = true
      cleanup()
    }
  }, [chart])

  return <div ref={box} className="absolute inset-0" aria-hidden="true" />
}
