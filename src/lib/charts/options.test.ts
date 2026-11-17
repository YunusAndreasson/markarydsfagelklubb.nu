import { describe, expect, it } from "vitest"
import {
  buildOption,
  type ChartData,
  chartHref,
  type MigrationRow,
  migrationHeight,
  phenologyCells,
} from "./options"

describe("phenologyCells", () => {
  it("scales each species to its own busiest week", () => {
    const cells = phenologyCells({
      species: [
        { name: "Talgoxe", weeks: [400, 200, 0] },
        { name: "Gök", weeks: [0, 3, 12] },
      ],
    })
    const top = (row: number) => Math.max(...cells.filter((c) => c[1] === row).map((c) => c[2]))
    expect(top(0)).toBe(1)
    expect(top(1)).toBe(1)
    // Empty weeks get no cell; the count stays for the tooltip.
    expect(cells).toHaveLength(4)
    expect(cells).toContainEqual([1, 1, 0.25, 3])
  })
})

const row = (name: string, href: string | null, thisYear: MigrationRow["thisYear"] = null) => ({
  name,
  href,
  weeks: Array.from({ length: 53 }, (_, week) => (week === 18 ? 4 : 0)),
  arrival: "7\u00a0maj",
  departure: null,
  thisYear,
})

const migrationChart: ChartData = {
  kind: "migration",
  data: {
    years: 20,
    today: 45,
    panels: [
      {
        label: "Flyttfåglar",
        kind: "summer",
        rows: [
          row("gök", "/arter/gok", { week: 17, day: "2\u00a0maj" }),
          row("trana", "/arter/trana"),
        ],
      },
      { label: "Vintergäster", kind: "winter", rows: [row("sidensvans", "/arter/sidensvans")] },
    ],
  },
}

describe("migration", () => {
  it("draws a panel per kind on one week axis, today as a rule, this year's arrivals as dots", () => {
    const option = buildOption(migrationChart, false) as {
      grid: { top: number; height: number }[]
      series: { type: string; data: unknown[]; markLine?: { data: { xAxis: number }[] } }[]
    }
    expect(option.grid).toHaveLength(2)
    expect(option.grid[1]?.top).toBeGreaterThan(
      (option.grid[0]?.top ?? 0) + (option.grid[0]?.height ?? 0)
    )
    const [summer, winter, dots] = option.series
    expect(summer?.type).toBe("heatmap")
    expect(summer?.markLine?.data[0]?.xAxis).toBe(45)
    expect(winter?.markLine?.data[0]?.xAxis).toBe(45)
    expect(dots?.type).toBe("scatter")
    expect(dots?.data).toEqual([[17, 0]])
  })

  it("sizes the box from its rows", () => {
    expect(
      migrationHeight(migrationChart.kind === "migration" ? migrationChart.data : { panels: [] })
    ).toBe(28 + 3 * 16 + 44 + 28)
  })

  it("opens a bird's species page from its row, its dot or its name", () => {
    expect(
      chartHref(migrationChart, {
        componentType: "series",
        seriesType: "heatmap",
        seriesIndex: 1,
        value: [3, 0, 1, 4],
      })
    ).toBe("/arter/sidensvans")
    expect(
      chartHref(migrationChart, {
        componentType: "series",
        seriesType: "scatter",
        seriesIndex: 2,
        value: [17, 0],
      })
    ).toBe("/arter/gok")
    expect(chartHref(migrationChart, { componentType: "yAxis", value: "trana" })).toBe(
      "/arter/trana"
    )
    expect(
      chartHref(
        { kind: "seasons", data: { years: [], shares: [] } },
        { componentType: "series", value: [0, 0, 1] }
      )
    ).toBeNull()
  })
})

describe("history", () => {
  it("has no zoom: the bars fit, and a zoom would take the page's scroll", () => {
    const option = buildOption(
      {
        kind: "history",
        data: { years: [{ year: 1986, reports: 246, species: 120, observers: 8 }], marks: [1986] },
      },
      false
    ) as Record<string, unknown>
    expect(option.dataZoom).toBeUndefined()
  })
})
