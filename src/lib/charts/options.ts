import type { EChartsCoreOption } from "echarts/core"
import { fontSans, formatNumber, ink, MONTHS_SHORT, sequence } from "./theme"

/**
 * ECharts options for the Obsar figures. They run in the browser only (the
 * island), so formatters can be functions. Every builder takes the same data
 * its figure's server-drawn SVG and caption were made from.
 */

export type ArtkurvaData = {
  year: number
  current: (number | null)[]
  previous: number[] | null
  average: number[] | null
  low: number[] | null
  high: number[] | null
  averageYears: number
}

export type PhenologyData = { species: { name: string; weeks: number[] }[] }

export type AccumulationData = {
  points: { year: number; total: number; added: number }[]
  founded: number
}

export type HistoryData = {
  years: { year: number; reports: number; species: number; observers: number }[]
  marks: number[]
}

export type SeasonsData = { years: number[]; shares: number[][] }

/** One bird in "Flyttfåglarnas år" (built by `migration` in `lib/season.ts`). */
export type MigrationRow = {
  name: string
  /** The species page, or null for a bird that has none. */
  href: string | null
  /** Reports per week bin (0–52) over the window. */
  weeks: number[]
  /** The usual days in words ("7 maj"), or null. */
  arrival: string | null
  departure: string | null
  /** This year's arrival, a summer bird only: its week bin and its day in words. */
  thisYear: { week: number; day: string } | null
}

export type MigrationData = {
  panels: { label: string; kind: "summer" | "winter"; rows: MigrationRow[] }[]
  /** How many years the weeks are summed over. */
  years: number
  /** The week bin today falls in. */
  today: number
}

export type ChartData =
  | { kind: "artkurva"; data: ArtkurvaData }
  | { kind: "phenology"; data: PhenologyData }
  | { kind: "accumulation"; data: AccumulationData }
  | { kind: "history"; data: HistoryData }
  | { kind: "people"; data: HistoryData }
  | { kind: "seasons"; data: SeasonsData }
  | { kind: "migration"; data: MigrationData }

const axisLabel = { color: ink.pencil, fontFamily: fontSans, fontSize: 12 }
const axisLine = { lineStyle: { color: ink.line } }
/** Solid hairlines: a dashed grid reads as a projection or a threshold. */
const splitLine = { lineStyle: { color: ink.line, width: 1 } }

/** A normal year's range on the artkurva: sequence[1] lightened, under every line. */
export const bandColor = "rgba(201,218,211,0.6)"

const tooltipBase = {
  backgroundColor: ink.white,
  borderColor: ink.line,
  borderWidth: 1,
  padding: [8, 12],
  textStyle: { color: ink.black, fontFamily: fontSans, fontSize: 13 },
  extraCssText: "box-shadow:none;border-radius:4px;font-variant-numeric:tabular-nums;",
}

const dayMonth = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
})

/** Day index (0 = 1 January) in a leap year, so 29 February has a name. */
export function dayLabel(index: number): string {
  return dayMonth.format(new Date(Date.UTC(2024, 0, 1 + index)))
}

/** Where each month starts, as a day index, for the x axis of a year. */
const MONTH_STARTS = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]

/** Week bins (0–52) where a month begins, for month labels on a weekly axis. */
const MONTH_WEEKS = MONTH_STARTS.map((start) => Math.floor(start / 7))

function weekAxis(boundaryGap: boolean, position?: "top", narrow = false) {
  const shown = narrow ? MONTH_WEEKS.filter((_, month) => month % 3 === 0) : MONTH_WEEKS
  return {
    type: "category" as const,
    position,
    boundaryGap,
    data: Array.from({ length: 53 }, (_, week) => week),
    axisLine,
    axisTick: { show: false },
    axisLabel: {
      ...axisLabel,
      interval: (week: number) => shown.includes(week),
      formatter: (value: string) => MONTHS_SHORT[MONTH_WEEKS.indexOf(Number(value))] ?? "",
    },
  }
}

/** "8–14 mars" for a week bin. */
export function weekLabel(week: number): string {
  const first = week * 7
  const last = week === 52 ? 365 : first + 6
  const [fromDay, fromMonth] = dayLabel(first).split(" ")
  const to = dayLabel(last)
  return to.endsWith(` ${fromMonth}`) ? `${fromDay}–${to}` : `${fromDay} ${fromMonth}–${to}`
}

/** The normal-range band: its two stacked series, named so the tooltip can skip them. */
const BAND_BASE = "band-base"
const BAND = "band"

function artkurva(data: ArtkurvaData, motion: boolean, narrow: boolean): EChartsCoreOption {
  const series: object[] = []
  const { low, high } = data
  if (low && high) {
    // The confidence-band pattern: an invisible line at the bottom, and the
    // range stacked on it with a fill.
    const band = {
      type: "line",
      stack: "normal",
      showSymbol: false,
      silent: true,
      lineStyle: { opacity: 0 },
      emphasis: { disabled: true },
    }
    series.push({ ...band, name: BAND_BASE, data: low })
    series.push({
      ...band,
      name: BAND,
      data: high.map((value, week) => value - (low[week] ?? 0)),
      areaStyle: { color: bandColor, opacity: 1 },
    })
  }
  if (data.average) {
    series.push({
      name: `Snitt ${data.averageYears} år`,
      type: "line",
      data: data.average,
      showSymbol: false,
      lineStyle: { color: ink.pencil, width: 1.5 },
      itemStyle: { color: ink.pencil },
    })
  }
  if (data.previous) {
    series.push({
      name: String(data.year - 1),
      type: "line",
      data: data.previous,
      showSymbol: false,
      lineStyle: { color: sequence[2], width: 2 },
      itemStyle: { color: sequence[2] },
    })
  }
  series.push({
    name: String(data.year),
    type: "line",
    data: data.current,
    showSymbol: false,
    lineStyle: { color: ink.gran, width: 3 },
    itemStyle: { color: ink.gran },
    endLabel: {
      show: true,
      formatter: narrow ? "{c}" : `${data.year}: {c} arter`,
      ...axisLabel,
      color: ink.black,
      fontWeight: 600,
    },
    emphasis: { focus: "series" },
  })
  return {
    animation: motion,
    animationDuration: 900,
    grid: { left: 32, right: narrow ? 36 : 96, top: 16, bottom: 28 },
    xAxis: weekAxis(false, undefined, narrow),
    yAxis: { type: "value", axisLabel, splitLine, minInterval: 10 },
    tooltip: {
      ...tooltipBase,
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: ink.green, width: 1 } },
      formatter: (
        items: { seriesName: string; value: number | null; dataIndex: number; color: string }[]
      ) => {
        const week = items[0]?.dataIndex ?? 0
        const rows = items
          .filter((item) => item.seriesName !== BAND_BASE && item.seriesName !== BAND)
          .filter((item) => item.value !== null && item.value !== undefined)
          .reverse()
          .map(
            (item) =>
              `<div>${item.seriesName}: <b>${formatNumber(Math.round(item.value ?? 0))}</b> arter</div>`
          )
        const range =
          low && high
            ? `<div style="color:${ink.pencil}">Vanligt år: ${low[week]}–${high[week]} arter</div>`
            : ""
        return `<div style="margin-bottom:4px;color:${ink.pencil}">t.o.m. ${dayLabel(Math.min(365, week * 7 + 6))}</div>${rows.join("")}${range}`
      },
    },
    series,
  }
}

function phenology(data: PhenologyData, motion: boolean, narrow: boolean): EChartsCoreOption {
  const names = data.species.map((one) => one.name)
  const cells = phenologyCells(data)
  return {
    animation: motion,
    grid: { left: narrow ? 104 : 132, right: 8, top: 28, bottom: 12 },
    xAxis: { ...weekAxis(true, "top", narrow), axisLine: { show: false } },
    yAxis: {
      type: "category",
      inverse: true,
      data: names,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        ...axisLabel,
        color: ink.black,
        fontSize: 12,
        width: narrow ? 96 : 120,
        overflow: "truncate",
      },
    },
    visualMap: {
      show: false,
      dimension: 2,
      min: 0,
      max: 1,
      inRange: { color: sequence.slice(1) },
    },
    tooltip: {
      ...tooltipBase,
      formatter: (item: { value: [number, number, number, number] }) => {
        const [week, row, , count] = item.value
        return `<b>${names[row]}</b><div style="color:${ink.pencil}">${weekLabel(week)}</div>${formatNumber(count)} ${count === 1 ? "rapport" : "rapporter"}`
      },
    },
    series: [
      {
        type: "heatmap",
        data: cells,
        itemStyle: { borderColor: ink.white, borderWidth: 1 },
        emphasis: { itemStyle: { borderColor: ink.green, borderWidth: 2 } },
      },
    ],
  }
}

/**
 * Heatmap cells `[week, row, share, count]`, where share is the week's reports
 * against the species' own busiest week. Each row then shows its season's shape:
 * on one scale for all, a tit's hundreds of reports would leave a cuckoo's dozen pale.
 */
export function phenologyCells(data: PhenologyData): [number, number, number, number][] {
  const cells: [number, number, number, number][] = []
  data.species.forEach((one, row) => {
    const top = Math.max(1, ...one.weeks)
    one.weeks.forEach((count, week) => {
      if (count > 0) cells.push([week, row, Math.round((count / top) * 100) / 100, count])
    })
  })
  return cells
}

function accumulation(data: AccumulationData, motion: boolean, narrow: boolean): EChartsCoreOption {
  return {
    animation: motion,
    animationDuration: 1200,
    grid: { left: 40, right: 16, top: 16, bottom: 28 },
    xAxis: {
      type: "category",
      data: data.points.map((one) => one.year),
      axisLine,
      axisTick: { show: false },
      axisLabel: {
        ...axisLabel,
        interval: (_: number, value: string) => Number(value) % (narrow ? 20 : 10) === 0,
      },
    },
    yAxis: { type: "value", axisLabel, splitLine, min: 0 },
    tooltip: {
      ...tooltipBase,
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: ink.green, width: 1 } },
      formatter: (items: { dataIndex: number }[]) => {
        const point = data.points[items[0]?.dataIndex ?? 0]
        if (!point) return ""
        const added = point.added
          ? `${point.added} ${point.added === 1 ? "ny art" : "nya arter"}`
          : "inga nya arter"
        return `<div style="color:${ink.pencil}">${point.year}</div><div><b>${point.total}</b> arter kända</div><div>${added}</div>`
      },
    },
    series: [
      {
        type: "line",
        step: "end",
        data: data.points.map((one) => one.total),
        showSymbol: false,
        lineStyle: { color: ink.gran, width: 2.5 },
        areaStyle: { color: ink.ice, opacity: 0.8 },
        markLine: {
          silent: true,
          symbol: "none",
          label: {
            formatter: `${data.founded}: klubben bildas`,
            ...axisLabel,
            position: "insideEndTop",
          },
          lineStyle: { color: ink.pencil, type: "dashed", width: 1 },
          data: [{ xAxis: String(data.founded) }],
        },
      },
    ],
  }
}

/**
 * The jubilee band's bars, on Gran: light marks on dark, the marked years
 * (founding, this year) in Reflex. No zoom: 57 bars fit, and a wheel or pinch
 * zoom would take the page's scroll.
 */
function history(data: HistoryData, motion: boolean, narrow: boolean): EChartsCoreOption {
  const label = { ...axisLabel, color: "#B7CBC3" }
  return {
    animation: motion,
    animationDuration: 900,
    animationEasing: "cubicOut",
    animationDelay: (index: number) => index * 12,
    grid: { left: 8, right: 8, top: 12, bottom: 24 },
    xAxis: {
      type: "category",
      data: data.years.map((one) => one.year),
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
      axisTick: { show: false },
      axisLabel: {
        ...label,
        interval: (_: number, value: string) => Number(value) % (narrow ? 20 : 10) === 0,
      },
    },
    yAxis: { type: "value", show: false },
    tooltip: {
      ...tooltipBase,
      trigger: "axis",
      axisPointer: { type: "shadow", shadowStyle: { color: "rgba(255,255,255,0.08)" } },
      formatter: (items: { dataIndex: number }[]) => {
        const one = data.years[items[0]?.dataIndex ?? 0]
        if (!one) return ""
        if (!one.reports) return `<b>${one.year}</b><div>Inga rapporter</div>`
        return `<b>${one.year}</b><div>${formatNumber(one.reports)} rapporter</div><div>${one.species} arter</div><div>${one.observers} rapportörer</div>`
      },
    },
    series: [
      {
        type: "bar",
        barCategoryGap: "22%",
        data: data.years.map((one) => ({
          value: one.reports,
          itemStyle: {
            color: data.marks.includes(one.year) ? ink.reflex : "rgba(255,255,255,0.55)",
            borderRadius: [1, 1, 0, 0],
          },
        })),
        emphasis: { itemStyle: { color: ink.white } },
      },
    ],
  }
}

/**
 * Where the two panels of the people figure sit, as shares of the box, so the
 * server's SVG can be laid out the same way under the canvas.
 */
export const PEOPLE_PANELS = [
  { top: 0.1, height: 0.32 },
  { top: 0.58, height: 0.32 },
] as const

/** Species and observers as two panels on one year axis: two measures, two scales. */
function people(data: HistoryData, motion: boolean, narrow: boolean): EChartsCoreOption {
  const years = data.years.map((one) => one.year)
  const panels = [
    { name: "Arter", values: data.years.map((one) => one.species || null) },
    { name: "Rapportörer", values: data.years.map((one) => one.observers || null) },
  ]
  const percent = (share: number) => `${Math.round(share * 1000) / 10}%`
  return {
    animation: motion,
    grid: PEOPLE_PANELS.map((panel) => ({
      left: 40,
      right: 16,
      top: percent(panel.top),
      height: percent(panel.height),
    })),
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    xAxis: panels.map((_, index) => ({
      type: "category",
      gridIndex: index,
      data: years,
      boundaryGap: false,
      axisLine,
      axisTick: { show: false },
      axisLabel: {
        ...axisLabel,
        show: index === panels.length - 1,
        interval: (_: number, value: string) => Number(value) % (narrow ? 20 : 10) === 0,
      },
    })),
    yAxis: panels.map((panel, index) => ({
      type: "value",
      gridIndex: index,
      name: panel.name,
      nameLocation: "end",
      nameGap: 10,
      nameTextStyle: { ...axisLabel, color: ink.black, fontWeight: 600, align: "left" },
      splitNumber: 3,
      axisLabel,
      splitLine,
    })),
    tooltip: {
      ...tooltipBase,
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: ink.green, width: 1 } },
      formatter: (items: { dataIndex: number }[]) => {
        const one = data.years[items[0]?.dataIndex ?? 0]
        return one
          ? `<b>${one.year}</b><div>${one.species} arter</div><div>${one.observers} rapportörer</div>`
          : ""
      },
    },
    series: panels.map((panel, index) => ({
      name: panel.name,
      type: "line",
      xAxisIndex: index,
      yAxisIndex: index,
      data: panel.values,
      showSymbol: false,
      connectNulls: false,
      lineStyle: { color: ink.gran, width: 2 },
      itemStyle: { color: ink.gran },
    })),
  }
}

function seasons(data: SeasonsData, motion: boolean): EChartsCoreOption {
  const cells: [number, number, number][] = []
  data.shares.forEach((months, row) => {
    months.forEach((share, month) => {
      cells.push([month, row, share])
    })
  })
  return {
    animation: motion,
    grid: { left: 44, right: 8, top: 24, bottom: 40 },
    xAxis: {
      type: "category",
      position: "top",
      data: [...MONTHS_SHORT],
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel,
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: data.years.map(String),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { ...axisLabel, interval: (_: number, value: string) => Number(value) % 5 === 0 },
    },
    // The scale is shown, so a dark cell has a size: a quarter of the year's reports.
    visualMap: {
      min: 0,
      max: 25,
      orient: "horizontal",
      left: 44,
      bottom: 0,
      itemWidth: 12,
      itemHeight: 120,
      text: ["25 %", "0 %"],
      textGap: 8,
      textStyle: axisLabel,
      calculable: false,
      hoverLink: false,
      inRange: { color: [...sequence] },
    },
    tooltip: {
      ...tooltipBase,
      formatter: (item: { value: [number, number, number] }) => {
        const [month, row, share] = item.value
        return `<b>${MONTHS_SHORT[month]} ${data.years[row]}</b><div>${share.toLocaleString("sv-SE")} % av årets rapporter</div>`
      },
    },
    series: [
      {
        type: "heatmap",
        data: cells,
        itemStyle: { borderColor: ink.white, borderWidth: 1 },
        emphasis: { itemStyle: { borderColor: ink.green, borderWidth: 2 } },
      },
    ],
  }
}

/** Pixel layout of "Flyttfåglarnas år", so the page can size the box before the script runs. */
export const MIGRATION_LAYOUT = { row: 16, top: 28, gap: 44, bottom: 28 } as const

/** The box's height in pixels for these panels. */
export function migrationHeight(data: Pick<MigrationData, "panels">): number {
  const { row, top, gap, bottom } = MIGRATION_LAYOUT
  const panels = data.panels.filter((panel) => panel.rows.length > 0)
  const rows = panels.reduce((sum, panel) => sum + panel.rows.length, 0)
  return top + rows * row + Math.max(0, panels.length - 1) * gap + bottom
}

/** "Brukar komma 7 maj och lämna 16 aug." in a tooltip's quiet line. */
function usualLine(kind: "summer" | "winter", row: MigrationRow): string {
  const come = row.arrival
    ? kind === "winter"
      ? `Brukar komma tillbaka ${row.arrival}`
      : `Brukar komma ${row.arrival}`
    : null
  const leave = row.departure ? `lämna ${row.departure}` : null
  if (!come && !leave) return ""
  const text = come && leave ? `${come} och ${leave}` : (come ?? `Brukar ${leave}`)
  return `<div style="color:${ink.pencil}">${text}</div>`
}

/**
 * "Flyttfåglarnas år": a heatmap row per bird, scaled to its own busiest week
 * as "Årets rytm" is, summer birds and winter guests in two panels on one week
 * axis. Today is a green rule and this year's arrivals green dots, the way the
 * species page marks this week and this year.
 */
function migration(data: MigrationData, motion: boolean, narrow: boolean): EChartsCoreOption {
  const { row: rowHeight, top, gap } = MIGRATION_LAYOUT
  const panels = data.panels.filter((panel) => panel.rows.length > 0)
  const left = narrow ? 104 : 140
  let y = top
  const grids = panels.map((panel) => {
    const grid = { left, right: 8, top: y, height: panel.rows.length * rowHeight }
    y += grid.height + gap
    return grid
  })
  const last = panels.length - 1
  const heatmaps = panels.map((panel, index) => ({
    type: "heatmap",
    name: panel.label,
    xAxisIndex: index,
    yAxisIndex: index,
    data: phenologyCells({ species: panel.rows }),
    itemStyle: { borderColor: ink.white, borderWidth: 1 },
    emphasis: { itemStyle: { borderColor: ink.green, borderWidth: 2 } },
    markLine: {
      silent: true,
      symbol: "none",
      animation: false,
      lineStyle: { color: ink.green, width: 1.5, type: "solid" },
      label:
        index === last
          ? {
              formatter: "I dag",
              // The y axis is inverted, so the line's end is at the bottom, clear of the months.
              position: "end",
              ...axisLabel,
              color: ink.green,
              fontWeight: 600,
            }
          : { show: false },
      data: [{ xAxis: data.today }],
    },
  }))
  const first = panels[0]
  const dots = {
    type: "scatter",
    name: "I år",
    xAxisIndex: 0,
    yAxisIndex: 0,
    z: 3,
    symbolSize: 7,
    itemStyle: { color: ink.green, borderColor: ink.white, borderWidth: 1.5 },
    data: (first?.kind === "summer" ? first.rows : []).flatMap((row, index) =>
      row.thisYear ? [[row.thisYear.week, index]] : []
    ),
  }
  return {
    animation: motion,
    grid: grids,
    xAxis: panels.map((_, index) => ({
      ...weekAxis(true, "top", narrow),
      gridIndex: index,
      axisLine: { show: false },
    })),
    yAxis: panels.map((panel, index) => ({
      type: "category",
      gridIndex: index,
      inverse: true,
      triggerEvent: true,
      data: panel.rows.map((row) => row.name),
      name: panel.label,
      nameLocation: "start",
      nameGap: 22,
      nameTextStyle: {
        ...axisLabel,
        color: ink.black,
        fontWeight: 600,
        align: "right",
        padding: [0, 8, 0, 0],
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        ...axisLabel,
        color: ink.black,
        // Every bird named: ECharts would otherwise drop every other label.
        interval: 0,
        width: left - 8,
        overflow: "truncate",
      },
    })),
    visualMap: {
      show: false,
      dimension: 2,
      min: 0,
      max: 1,
      seriesIndex: panels.map((_, index) => index),
      inRange: { color: sequence.slice(1) },
    },
    tooltip: {
      ...tooltipBase,
      formatter: (item: { seriesIndex: number; seriesType: string; value: number[] }) => {
        if (item.seriesType === "scatter") {
          const row = first?.rows[item.value[1] ?? -1]
          if (!row?.thisYear) return ""
          return `<b>${row.name}</b><div>I år kom den första ${row.thisYear.day}</div>${usualLine("summer", row)}`
        }
        const panel = panels[item.seriesIndex]
        const [week = 0, index = 0, , count = 0] = item.value
        const row = panel?.rows[index]
        if (!panel || !row) return ""
        return `<b>${row.name}</b><div style="color:${ink.pencil}">${weekLabel(week)}</div><div>${formatNumber(count)} ${count === 1 ? "rapport" : "rapporter"} på ${data.years} år</div>${usualLine(panel.kind, row)}`
      },
    },
    series: [...heatmaps, dots],
  }
}

/** What a click on the chart opens: a bird's row or name in "Flyttfåglarnas år". */
export type ChartClick = {
  componentType?: string
  seriesIndex?: number
  seriesType?: string
  value?: unknown
}

export function chartHref(chart: ChartData, click: ChartClick): string | null {
  if (chart.kind !== "migration") return null
  const panels = chart.data.panels.filter((panel) => panel.rows.length > 0)
  const rows = panels.flatMap((panel) => panel.rows)
  if (click.componentType === "yAxis") {
    return rows.find((row) => row.name === click.value)?.href ?? null
  }
  if (click.componentType !== "series" || !Array.isArray(click.value)) return null
  const panel = click.seriesType === "scatter" ? panels[0] : panels[click.seriesIndex ?? -1]
  const index = click.value[1]
  return typeof index === "number" ? (panel?.rows[index]?.href ?? null) : null
}

/** `narrow`: the chart is under 480 px wide, so labels thin out and margins tighten. */
export function buildOption(chart: ChartData, motion: boolean, narrow = false): EChartsCoreOption {
  switch (chart.kind) {
    case "artkurva":
      return artkurva(chart.data, motion, narrow)
    case "phenology":
      return phenology(chart.data, motion, narrow)
    case "accumulation":
      return accumulation(chart.data, motion, narrow)
    case "history":
      return history(chart.data, motion, narrow)
    case "people":
      return people(chart.data, motion, narrow)
    case "seasons":
      return seasons(chart.data, motion)
    case "migration":
      return migration(chart.data, motion, narrow)
  }
}
