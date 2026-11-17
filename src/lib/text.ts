/**
 * Small wording helpers shared by the public pages, so a phrase reads the same
 * wherever it's printed.
 */

/** "fredag 30 oktober" → "Fredag 30 oktober": a heading or a sentence's start. */
export function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase("sv") + text.slice(1)
}

/**
 * A count and its noun, with a no-break space so the two never part at a line
 * end: "1 rapport", "248 rapporter", "3 187 rapporter".
 */
export function counted(count: number, one: string, many: string): string {
  return `${count.toLocaleString("sv-SE")} ${count === 1 ? one : many}`
}

export const rapporter = (count: number): string => counted(count, "rapport", "rapporter")
