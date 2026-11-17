/**
 * The charts' palette and type, from the site's tokens (docs/design.md,
 * "Obsar och statistik"). Plain values, because a canvas can't read CSS
 * variables and the server-drawn SVG fallback uses the same ones.
 */
export const ink = {
  gran: "#14302A",
  black: "#17201D",
  pencil: "#53605B",
  green: "#137D41",
  ice: "#EEF3F1",
  line: "#DDE5E1",
  reflex: "#F2C230",
  white: "#FFFFFF",
  /**
   * Data colour (docs/design.md, "Linjalen"): a chart's ordinary marks on white
   * are a mid tint of Gran, and the one it points out (this week, this year,
   * today) is `mark`, full ink. Green stays for what the pointer is on, since
   * green means "you can act on this".
   */
  tint: "#8FB0A4",
  mark: "#17201D",
  /** Ordinary marks on a Gran band; Reflex marks the ones it points out. */
  onGran: "rgba(255,255,255,0.55)",
} as const

/** Is to Gran, one hue, for heatmaps. */
export const sequence = ["#EEF3F1", "#C9DAD3", "#8FB0A4", "#4F7A6C", "#14302A"] as const

export const fontSans = "'Inter Variable', system-ui, sans-serif"
export const fontDisplay = "'Alegreya Variable', Georgia, serif"

export const MONTHS_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
] as const

const number = new Intl.NumberFormat("sv-SE")
/** "77 572": the Swedish thousands space. */
export function formatNumber(value: number): string {
  return number.format(value)
}
