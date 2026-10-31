/**
 * Sorts the Obsar section's links by what a member came to do (docs/design.md,
 * "Obsar"): report a bird, look at the kommun, look further afield. The titles
 * come from the page tree, so anything unrecognised lands with the kommun's own
 * links rather than vanishing. A description in /admin outranks the one here.
 */

const REGIONS = new Set(["Blekinge", "Halland", "Skåne", "Småland", "Öland"])

const DESCRIPTIONS: readonly [RegExp, string][] = [
  [
    /^Rapportera/,
    "Lägg in det du har sett. Klubbens listor och årssammanställningar bygger på det.",
  ],
  [/^Kommunobservationer/, "Alla fynd i Markaryds kommun, senaste först."],
  [/^Årslista/, "Arterna som setts i kommunen i år."],
  [/^Markarydslistan/, "Arterna som någonsin setts i kommunen."],
  [/^Observatörsligan/, "Vem som har sett flest arter i kommunen i år."],
]

type Entry = { title: string; description?: string }

export function groupObsar<T extends Entry>(entries: readonly T[]) {
  const report: T[] = []
  const kommun: T[] = []
  const regions: T[] = []
  for (const entry of entries) {
    if (REGIONS.has(entry.title)) regions.push(entry)
    else if (entry.title.startsWith("Rapportera")) report.push(entry)
    else kommun.push(entry)
  }
  return { report, kommun, regions }
}

export function obsarDescription(entry: Entry): string {
  if (entry.description) return entry.description
  return DESCRIPTIONS.find(([pattern]) => pattern.test(entry.title))?.[1] ?? ""
}
