import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { fontSans, ink } from "@/lib/charts/theme"

/**
 * The year's league as a race (docs/design.md, "Obsar och statistik"): the
 * top observers' running species counts, week by week, with a play button and
 * a slider. It starts at the end, showing where the year stands, and moves
 * only when asked. The table under it on the page has the same numbers in full.
 */

type Runner = { name: string; curve: string[] }

type Props = {
  year: number
  /** The last day to show, `YYYY-MM-DD`: today for this year, 31 December otherwise. */
  until: string
  runners: Runner[]
}

const SHOWN = 12
const dayMonthFormat = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
})

function dateAt(year: number, index: number): string {
  return new Date(Date.UTC(year, 0, 1 + index)).toISOString().slice(0, 10)
}

function countAt(curve: string[], date: string): number {
  let count = 0
  for (const day of curve) {
    if (day > date) break
    count++
  }
  return count
}

type Chart = { setOption: (option: object) => void }

function drawRace(instance: Chart, runners: Runner[], at: string) {
  const rows = runners.map((runner) => ({ name: runner.name, value: countAt(runner.curve, at) }))
  instance.setOption({
    yAxis: { data: rows.map((row) => row.name) },
    series: [{ data: rows.map((row) => row.value) }],
  })
}

export default function LeagueRace({ year, until, runners }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const lastIndex = Math.round(
    (Date.parse(`${until}T00:00:00Z`) - Date.UTC(year, 0, 1)) / 86_400_000
  )
  /** Week steps, ending exactly on the last day. */
  const frames = useMemo(() => {
    const out: number[] = []
    for (let index = 6; index < lastIndex; index += 7) out.push(index)
    out.push(lastIndex)
    return out
  }, [lastIndex])
  const [frame, setFrame] = useState(frames.length - 1)
  const [playing, setPlaying] = useState(false)
  const date = dateAt(year, frames[frame] ?? lastIndex)
  // The chart loads after the slider can move, so its first draw reads this.
  const dateRef = useRef(date)
  dateRef.current = date
  const dateLabel = dayMonthFormat.format(new Date(`${date}T00:00:00Z`))

  useEffect(() => {
    const element = box.current
    if (!element) return
    let disposed = false
    let cleanup = () => {}
    ;(async () => {
      // As in ObsarChart: keeps ECharts out of the Worker bundle.
      if (import.meta.env.SSR) return
      const { init } = await import("@/lib/charts/echarts-setup")
      if (disposed) return
      const instance = init(element, undefined, { renderer: "canvas" })
      chartRef.current = instance
      // Under reduced motion the race still plays, week by week, but the bars
      // jump to their places instead of sliding there.
      const motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      instance.setOption({
        animation: motion,
        animationDurationUpdate: motion ? 450 : 0,
        animationEasingUpdate: "linear",
        grid: { left: 8, right: 48, top: 4, bottom: 4, containLabel: true },
        xAxis: { type: "value", max: "dataMax", show: false },
        yAxis: {
          type: "category",
          inverse: true,
          max: SHOWN - 1,
          animationDuration: motion ? 300 : 0,
          animationDurationUpdate: motion ? 300 : 0,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: ink.black, fontFamily: fontSans, fontSize: 13 },
        },
        series: [
          {
            type: "bar",
            realtimeSort: true,
            barCategoryGap: "28%",
            itemStyle: { color: ink.gran, borderRadius: [0, 2, 2, 0] },
            label: {
              show: true,
              position: "right",
              valueAnimation: motion,
              color: ink.black,
              fontFamily: fontSans,
              fontWeight: 600,
              fontSize: 13,
            },
            data: [],
          },
        ],
      })
      element.closest<HTMLElement>("[data-chart]")?.setAttribute("data-ready", "")
      const observer = new ResizeObserver(() => instance.resize())
      observer.observe(element)
      cleanup = () => {
        observer.disconnect()
        instance.dispose()
        chartRef.current = null
      }
      drawRace(instance, runners, dateRef.current)
    })()
    return () => {
      disposed = true
      cleanup()
    }
  }, [runners])

  useEffect(() => {
    if (chartRef.current) drawRace(chartRef.current, runners, date)
  }, [runners, date])

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      setFrame((current) => {
        if (current >= frames.length - 1) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, 500)
    return () => clearInterval(timer)
  }, [playing, frames.length])

  function play() {
    if (frame >= frames.length - 1) setFrame(0)
    setPlaying(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          type="button"
          size="lg"
          className="focus-strong min-h-11"
          onClick={() => (playing ? setPlaying(false) : play())}
        >
          {playing ? "Pausa" : frame >= frames.length - 1 ? `Spela upp ${year}` : "Fortsätt"}
        </Button>
        <label className="flex min-w-48 flex-1 items-center gap-3">
          <span className="sr-only">Visa läget</span>
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={frame}
            aria-valuetext={dateLabel}
            onChange={(event) => {
              setPlaying(false)
              setFrame(Number(event.target.value))
            }}
            className="accent-primary w-full"
          />
        </label>
        <output
          className="type-label min-w-28 tabular-nums"
          // Quiet while it plays: a new date every half-second would drown a screen reader.
          aria-live={playing ? "off" : "polite"}
        >
          {dateLabel}
        </output>
      </div>
      <div data-chart className="relative h-[26rem] w-full">
        <div ref={box} className="absolute inset-0" aria-hidden="true" />
      </div>
    </div>
  )
}
