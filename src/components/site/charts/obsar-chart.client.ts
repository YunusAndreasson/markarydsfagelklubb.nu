import type { ChartData } from "@/lib/charts/options"
import { propsOf, whenVisible } from "@/lib/when-visible.client"

/**
 * The Obsar figures, drawn by ECharts over the server's SVG once each is near
 * the screen. `ChartFigure.astro` owns the box and the caption; this fills the
 * box and then marks it ready, which fades the SVG underneath. Nothing here can
 * reach the API or its key.
 */
export function mountObsarCharts(): void {
  for (const element of document.querySelectorAll<HTMLElement>("[data-obsar-chart]")) {
    const chart = propsOf<ChartData>(element)
    if (chart) whenVisible(element, () => void draw(element, chart))
  }
}

async function draw(element: HTMLElement, chart: ChartData): Promise<void> {
  // Loaded here, not at the top: ECharts stays out of every page's first load.
  const [{ init }, { buildOption, chartHref }] = await Promise.all([
    import("@/lib/charts/echarts-setup"),
    import("@/lib/charts/options"),
  ])
  const motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const instance = init(element, undefined, { renderer: "canvas" })
  const isNarrow = () => element.clientWidth < 480
  let narrow = isNarrow()
  instance.setOption(buildOption(chart, motion, narrow))
  // A bird's row or name opens its species page; the table under the figure
  // has the same links for a keyboard and a screen reader. On a touch screen a
  // tap is how a cell's tooltip opens, so there only the names navigate.
  const hovers = window.matchMedia("(hover: hover)").matches
  instance.on("click", (params) => {
    if (!hovers && params.componentType === "series") return
    const href = chartHref(chart, params)
    if (href) window.location.assign(href)
  })
  element.closest<HTMLElement>("[data-chart]")?.setAttribute("data-ready", "")
  // A phone turned sideways crosses the threshold: rebuild, don't just stretch.
  new ResizeObserver(() => {
    if (isNarrow() !== narrow) {
      narrow = isNarrow()
      instance.setOption(buildOption(chart, false, narrow), { notMerge: true })
    }
    instance.resize()
  }).observe(element)
}
