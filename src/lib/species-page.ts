import { arrivals, type Typical } from "./artportalen/taxa"
import type { TaxonEntry } from "./artportalen/types"
import { MONTHS_SHORT } from "./charts/theme"

/**
 * What a species page says and draws about its bird's year (docs/design.md,
 * "Arter"). Pure: the page passes the index entry and today, and gets back
 * words and coordinates.
 */

/** "23 apr" for a 1-based day of the year, read in a common (non-leap) year. */
export function dayMonth(day: number): string {
  const date = new Date(Date.UTC(2025, 0, day))
  return `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]}`
}

const NUMBERS = [
  "noll",
  "en",
  "två",
  "tre",
  "fyra",
  "fem",
  "sex",
  "sju",
  "åtta",
  "nio",
  "tio",
  "elva",
  "tolv",
]
/** Small counts as words, the way the site writes them in a sentence. */
export function countWord(value: number): string {
  return NUMBERS[value] ?? String(value)
}

const dayWord = (days: number) => (days === 1 ? "en dag" : `${countWord(days)} dagar`)

export type ArrivalFigure = {
  /** viewBox width and height; the marks scale with the box, the labels are HTML. */
  width: number
  height: number
  dots: {
    x: number
    y: number
    current: boolean
    year: number
    day: number
    /** That year's reports of the bird: one or two make a shaky first date. */
    reports: number
    /** Days from the typical arrival, later positive; null with no typical day. */
    offset: number | null
  }[]
  /** The typical arrival as a day and a y, for the dashed guide. */
  typical: number | null
  typicalY: number | null
  /** Month labels down the side: the 1st of each month in range, as a share from the top. */
  months: { label: string; top: number }[]
  /** Decade labels along the bottom, as a share from the left. */
  decades: { label: string; left: number }[]
  from: number
  to: number
}

const WIDTH = 640
const HEIGHT = 200
const PAD_X = 12
const PAD_Y = 10
/** A year with fewer reports than this has a first date that says little. */
export const FEW_REPORTS = 3

/**
 * The first sighting each year as dots, across the last forty years, with the
 * typical day as a guide. Later is lower, as on a calendar page.
 */
export function arrivalFigure(
  entry: TaxonEntry,
  thisYear: number,
  typical: number | null
): ArrivalFigure | null {
  const points = arrivals(entry).filter((one) => one.year > thisYear - 40)
  if (points.length < 3) return null
  const from = Math.min(...points.map((one) => one.year))
  const to = thisYear
  const days = points.map((one) => one.day)
  const low = Math.max(1, Math.min(...days) - 10)
  const high = Math.min(366, Math.max(...days) + 10)
  const y = (day: number) => PAD_Y + ((day - low) / Math.max(1, high - low)) * (HEIGHT - 2 * PAD_Y)
  const x = (year: number) => PAD_X + ((year - from) / Math.max(1, to - from)) * (WIDTH - 2 * PAD_X)

  const months: ArrivalFigure["months"] = []
  for (let month = 0; month < 12; month++) {
    const day = Math.round((Date.UTC(2025, month, 1) - Date.UTC(2025, 0, 1)) / 86_400_000) + 1
    if (day >= low && day <= high) {
      months.push({ label: `1 ${MONTHS_SHORT[month]}`, top: y(day) / HEIGHT })
    }
  }

  const decades: ArrivalFigure["decades"] = []
  for (let year = Math.ceil(from / 10) * 10; year <= to; year += 10) {
    decades.push({ label: String(year), left: x(year) / WIDTH })
  }

  return {
    width: WIDTH,
    height: HEIGHT,
    dots: points.map((one) => ({
      x: x(one.year),
      y: y(one.day),
      current: one.year === thisYear,
      year: one.year,
      day: one.day,
      reports: entry.years[one.year]?.r ?? 0,
      offset: typical === null ? null : one.day - typical,
    })),
    typical,
    typicalY: typical === null ? null : y(typical),
    months,
    decades,
    from,
    to,
  }
}

/** "som vanligt", "fem dagar tidigare än vanligt", "en dag senare än vanligt". */
export function offsetPhrase(diff: number): string {
  if (Math.abs(diff) <= 2) return "som vanligt"
  return diff < 0 ? `${dayWord(-diff)} tidigare än vanligt` : `${dayWord(diff)} senare än vanligt`
}

/**
 * The species page's ingress: what kind of bird it is here, in one sentence,
 * so the page says it once at the top instead of under each figure.
 * "En flyttfågel som brukar komma till kommunen kring 7 maj."
 */
export function leadSentence(typical: Typical, lastYear: number | null): string {
  const { arrival, departure, kind, years } = typical
  // Only the coming: a summer bird's last report is when it goes quiet (a
  // gök's is early July), not when it leaves, and "Över året" shows the rest.
  if (kind === "summer" && arrival !== null) {
    return `En flyttfågel som brukar komma till kommunen kring ${dayMonth(arrival)}.`
  }
  if (kind === "winter" && arrival !== null && departure !== null) {
    return `En vintergäst som brukar komma till kommunen kring ${dayMonth(arrival)} och stanna till kring ${dayMonth(departure)}.`
  }
  if (years >= 15)
    return "Finns i kommunen och rapporteras året runt, utan någon tydlig flyttningstid."
  if (years === 0) {
    return lastYear
      ? `Inte rapporterad i kommunen de senaste tjugo åren. Senast sedd ${lastYear}.`
      : "Inte rapporterad i kommunen de senaste tjugo åren."
  }
  return `Sedd i kommunen ${countWord(years)} av de senaste tjugo åren${years < 8 ? ", en ovanlig gäst" : ""}.`
}

/**
 * The arrival figure's caption: this year against the usual day, and the
 * earliest ever. The usual day itself is in the ingress and the legend.
 * "I år kom den första 18 apr, fem dagar tidigare än vanligt. Tidigast: 9 apr 2014."
 */
export function arrivalSentence(
  entry: TaxonEntry,
  typicalArrival: number,
  thisYear: number
): string {
  const parts: string[] = []
  const now = arrivals(entry).find((one) => one.year === thisYear)
  parts.push(
    now
      ? `I år kom den första ${dayMonth(now.day)}, ${offsetPhrase(now.day - typicalArrival)}.`
      : "I år har ingen rapporterats än."
  )
  const earliest = arrivals(entry).reduce((best, one) => (one.day < best.day ? one : best))
  parts.push(`Tidigast: ${dayMonth(earliest.day)} ${earliest.year}.`)
  return parts.join(" ")
}

/** Week bin → month: the month its middle day falls in. */
const monthOfWeek = (week: number) => new Date(Date.UTC(2025, 0, week * 7 + 4)).getUTCMonth()

const MONTH_NAMES = [
  "januari",
  "februari",
  "mars",
  "april",
  "maj",
  "juni",
  "juli",
  "augusti",
  "september",
  "oktober",
  "november",
  "december",
]

/** "Flest rapporter kommer i april och maj." — the one or two busiest months. */
export function yearSentence(weeks: readonly number[]): string | null {
  const months = Array.from({ length: 12 }, () => 0)
  weeks.forEach((count, week) => {
    const month = monthOfWeek(week)
    months[month] = (months[month] ?? 0) + count
  })
  const total = months.reduce((sum, one) => sum + one, 0)
  if (total === 0) return null
  const ranked = months.map((count, month) => ({ count, month })).sort((a, b) => b.count - a.count)
  const [top, next] = ranked
  if (!top) return null
  const pair = next && next.count >= top.count * 0.6
  const names = pair
    ? [top, next].sort((a, b) => a.month - b.month).map((one) => MONTH_NAMES[one.month])
    : [MONTH_NAMES[top.month]]
  return `Flest rapporter kommer i ${names.join(" och ")}.`
}

/** The week bin today falls in, to mark "now" on the year figure. */
export function weekOfDay(day: number): number {
  return Math.min(52, Math.floor((day - 1) / 7))
}
