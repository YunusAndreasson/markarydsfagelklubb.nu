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
  /** Drawn on the spruce band: light marks on dark. */
  onGran?: boolean
}

export type SeasonsData = { years: number[]; shares: number[][] }

export type ChartData =
  | { kind: "artkurva"; data: ArtkurvaData }
  | { kind: "phenology"; data: PhenologyData }
  | { kind: "accumulation"; data: AccumulationData }
  | { kind: "history"; data: HistoryData }
  | { kind: "people"; data: HistoryData }
  | { kind: "seasons"; data: SeasonsData }

const axisLabel = { color: ink.pencil, fontFamily: fontSans, fontSize: 12 }
const axisLine = { lineStyle: { color: ink.line } }
const splitLine = { lineStyle: { color: ink.line, type: "dashed" as const } }

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

function artkurva(data: ArtkurvaData, motion: boolean, narrow: boolean): EChartsCoreOption {
  const series: object[] = []
  if (data.average) {
    series.push({
      name: `Snitt ${data.averageYears} år`,
      type: "line",
      data: data.average,
      showSymbol: false,
      lineStyle: { color: ink.pencil, width: 1.5, type: "dashed" },
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
    areaStyle: { color: ink.ice, opacity: 0.8 },
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
        const rows = items
          .filter((item) => item.value !== null && item.value !== undefined)
          .map(
            (item) =>
              `<div>${item.seriesName}: <b>${formatNumber(Math.round(item.value ?? 0))}</b> arter</div>`
          )
        return `<div style="margin-bottom:4px;color:${ink.pencil}">t.o.m. ${dayLabel(Math.min(365, (items[0]?.dataIndex ?? 0) * 7 + 6))}</div>${rows.join("")}`
      },
    },
    series,
  }
}

function phenology(data: PhenologyData, motion: boolean, narrow: boolean): EChartsCoreOption {
  const names = data.species.map((one) => one.name)
  const cells: [number, number, number][] = []
  data.species.forEach((one, row) => {
    one.weeks.forEach((count, week) => {
      if (count > 0) cells.push([week, row, count])
    })
  })
  // The scale tops out at the 90th percentile, so a few record weeks don't
  // leave every other cell pale.
  const counts = cells.map((cell) => cell[2]).sort((a, b) => a - b)
  const top = Math.max(2, counts[Math.floor(counts.length * 0.9)] ?? 2)
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
      min: 1,
      max: top,
      inRange: { color: sequence.slice(1) },
    },
    tooltip: {
      ...tooltipBase,
      formatter: (item: { value: [number, number, number] }) => {
        const [week, row, count] = item.value
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

function history(data: HistoryData, motion: boolean, narrow: boolean): EChartsCoreOption {
  const onGran = Boolean(data.onGran)
  const label = { ...axisLabel, color: onGran ? "#B7CBC3" : ink.pencil }
  const plain = onGran ? "rgba(255,255,255,0.55)" : ink.gran
  const marked = onGran ? ink.reflex : ink.green
  return {
    animation: motion,
    animationDuration: 900,
    animationEasing: "cubicOut",
    animationDelay: (index: number) => index * 12,
    grid: { left: onGran ? 8 : 44, right: 8, top: 12, bottom: onGran ? 24 : 56 },
    xAxis: {
      type: "category",
      data: data.years.map((one) => one.year),
      axisLine: { lineStyle: { color: onGran ? "rgba(255,255,255,0.2)" : ink.line } },
      axisTick: { show: false },
      axisLabel: {
        ...label,
        interval: (_: number, value: string) => Number(value) % (narrow ? 20 : 10) === 0,
      },
    },
    yAxis: { type: "value", show: !onGran, axisLabel: label, splitLine },
    dataZoom: onGran
      ? []
      : [
          { type: "inside", start: 0, end: 100 },
          {
            type: "slider",
            height: 18,
            bottom: 8,
            borderColor: ink.line,
            fillerColor: "rgba(19,125,65,0.12)",
            handleStyle: { color: ink.white, borderColor: ink.green },
            moveHandleStyle: { color: ink.green },
            textStyle: label,
            dataBackground: { lineStyle: { color: ink.pencil }, areaStyle: { color: ink.ice } },
          },
        ],
    tooltip: {
      ...tooltipBase,
      trigger: "axis",
      axisPointer: {
        type: "shadow",
        shadowStyle: { color: onGran ? "rgba(255,255,255,0.08)" : "rgba(19,125,65,0.08)" },
      },
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
            color: data.marks.includes(one.year) ? marked : plain,
            borderRadius: [1, 1, 0, 0],
          },
        })),
        emphasis: { itemStyle: { color: onGran ? ink.white : ink.green } },
      },
    ],
  }
}

function people(data: HistoryData, motion: boolean, narrow: boolean): EChartsCoreOption {
  const years = data.years.map((one) => one.year)
  return {
    animation: motion,
    grid: { left: 36, right: narrow ? 84 : 96, top: 16, bottom: 28 },
    xAxis: {
      type: "category",
      data: years,
      boundaryGap: false,
      axisLine,
      axisTick: { show: false },
      axisLabel: {
        ...axisLabel,
        interval: (_: number, value: string) => Number(value) % (narrow ? 20 : 10) === 0,
      },
    },
    yAxis: { type: "value", axisLabel, splitLine },
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
    series: [
      {
        name: "Arter",
        type: "line",
        data: data.years.map((one) => one.species || null),
        showSymbol: false,
        connectNulls: false,
        lineStyle: { color: ink.gran, width: 2.5 },
        itemStyle: { color: ink.gran },
        endLabel: { show: true, formatter: "arter", ...axisLabel, color: ink.black },
      },
      {
        name: "Rapportörer",
        type: "line",
        data: data.years.map((one) => one.observers || null),
        showSymbol: false,
        lineStyle: { color: sequence[2], width: 2 },
        itemStyle: { color: sequence[2] },
        endLabel: { show: true, formatter: "rapportörer", ...axisLabel },
      },
    ],
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
    grid: { left: 44, right: 8, top: 24, bottom: 8 },
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
    visualMap: { show: false, min: 0, max: 25, inRange: { color: [...sequence] } },
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
  }
}
