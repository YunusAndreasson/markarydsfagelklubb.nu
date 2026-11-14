/**
 * The server-drawn first paint of a chart: plain SVG, a few hundred bytes,
 * well under a millisecond. ECharts' own SSR costs 35–220 ms of CPU per
 * chart (measured 2026-11-14), too much per request on a Worker, so ECharts
 * runs only in the browser and draws over this once its island is visible.
 *
 * The drawing is decoration for the figure's caption, which carries the finding
 * in words, so the SVG is `aria-hidden`. It scales to its box (viewBox, no
 * fixed size), and the island's box has the same aspect ratio, so nothing moves
 * when the canvas takes over.
 */

const round = (value: number) => Math.round(value * 10) / 10

export type Bar = { value: number; mark?: boolean }

export type BarsOptions = {
  bars: readonly Bar[]
  width: number
  height: number
  color: string
  markColor?: string
  /** Space between bars as a share of each slot. */
  gap?: number
}

export function barsSvg({
  bars,
  width,
  height,
  color,
  markColor,
  gap = 0.25,
}: BarsOptions): string {
  const max = Math.max(1, ...bars.map((bar) => bar.value))
  const slot = width / Math.max(1, bars.length)
  const barWidth = round(slot * (1 - gap))
  const plain: string[] = []
  const marked: string[] = []
  bars.forEach((bar, index) => {
    if (bar.value <= 0) return
    const h = Math.max(1, (bar.value / max) * height)
    const x = round(index * slot + (slot - barWidth) / 2)
    const rect = `M${x} ${round(height - h)}h${barWidth}V${height}h${-barWidth}Z`
    ;(bar.mark && markColor ? marked : plain).push(rect)
  })
  return svg(width, height, [
    plain.length ? `<path fill="${color}" d="${plain.join("")}"/>` : "",
    marked.length ? `<path fill="${markColor}" d="${marked.join("")}"/>` : "",
  ])
}

export type Line = {
  values: readonly (number | null)[]
  color: string
  width?: number
  dashed?: boolean
}

export type LinesOptions = {
  lines: readonly Line[]
  width: number
  height: number
  /** The y maximum; defaults to the largest value. */
  max?: number
  /** Horizontal guides at these values. */
  guides?: readonly number[]
  guideColor?: string
  /** Draw as steps, for a running count. */
  step?: boolean
  /** A filled range under the lines, e.g. a normal year's fewest to most. */
  band?: { low: readonly number[]; high: readonly number[]; color: string }
}

export function linesSvg({
  lines,
  width,
  height,
  max,
  guides = [],
  guideColor,
  step,
  band,
}: LinesOptions): string {
  const top =
    max ??
    Math.max(
      1,
      ...(band?.high ?? []),
      ...lines.flatMap((line) => line.values.filter((v): v is number => v !== null))
    )
  const length = Math.max(2, band?.high.length ?? 0, ...lines.map((line) => line.values.length))
  const x = (index: number) => round((index / (length - 1)) * width)
  const y = (value: number) => round(height - (value / top) * height)
  const parts = guides.map(
    (guide) =>
      `<path stroke="${guideColor ?? "currentColor"}" stroke-width="1" vector-effect="non-scaling-stroke" d="M0 ${y(guide)}H${width}"/>`
  )
  if (band && band.high.length > 1) {
    const upper = band.high.map((value, index) => `${index ? "L" : "M"}${x(index)} ${y(value)}`)
    const lower = band.low
      .map((value, index) => `L${x(index)} ${y(value)}`)
      .reverse()
      .join("")
    parts.push(`<path fill="${band.color}" stroke="none" d="${upper.join("")}${lower}Z"/>`)
  }
  for (const line of lines) {
    let d = ""
    let previous: number | null = null
    line.values.forEach((value, index) => {
      if (value === null) {
        previous = null
        return
      }
      if (previous === null) d += `M${x(index)} ${y(value)}`
      else if (step) d += `H${x(index)}V${y(value)}`
      else d += `L${x(index)} ${y(value)}`
      previous = value
    })
    if (!d) continue
    parts.push(
      `<path fill="none" stroke="${line.color}" stroke-width="${line.width ?? 2}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"${line.dashed ? ' stroke-dasharray="4 4"' : ""} d="${d}"/>`
    )
  }
  return svg(width, height, parts)
}

function svg(width: number, height: number, parts: string[]): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false" style="display:block;width:100%;height:100%">${parts.join("")}</svg>`
}
