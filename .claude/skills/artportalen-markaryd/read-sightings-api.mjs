// Reads Markaryd kommun's bird sightings for one day from Artportalen's API.
// Usage: node read-sightings-api.mjs [YYYY-MM-DD], default today in Sweden.
// The key comes from .artportalen-keys in the repo root, which git ignores.
import { readFileSync } from "node:fs"

const KEY_FILE = new URL("../../../.artportalen-keys", import.meta.url)
const API = "https://api.artdatabanken.se/species-observation-system/v1"
const PAGE_SIZE = 1000

const key = /^ARTPORTALEN_API_KEY_PRIMARY=(.+)$/m.exec(readFileSync(KEY_FILE, "utf8"))?.[1]?.trim()
if (!key) {
  console.error("ARTPORTALEN_API_KEY_PRIMARY is missing from .artportalen-keys")
  process.exit(1)
}

const date = process.argv[2] ?? new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" })
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`Expected YYYY-MM-DD, got ${date}`)
  process.exit(1)
}

const filter = {
  dataProvider: { ids: [1] },
  taxon: { ids: [4000104], includeUnderlyingTaxa: true },
  geographics: { areas: [{ areaType: "Municipality", featureId: "767" }] },
  date: { startDate: date, endDate: date, dateFilterType: "OverlappingStartDateAndEndDate" },
  // Listing the fields keeps observers out of the response.
  output: {
    fields: [
      "taxon.vernacularName",
      "taxon.scientificName",
      "occurrence.individualCount",
      "event.startDate",
      "location.locality",
    ],
  },
}

const records = []
let total = 0
do {
  const response = await fetch(`${API}/Observations/Search?skip=${records.length}&take=${PAGE_SIZE}&translationCultureCode=sv-SE`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify(filter),
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) {
    console.error(`API answered ${response.status}: ${(await response.text()).slice(0, 300)}`)
    process.exit(1)
  }
  const page = await response.json()
  total = page.totalCount
  if (page.records.length === 0) break
  records.push(...page.records)
} while (records.length < total)

const bySpecies = new Map()
const withoutCount = []
let individuals = 0
for (const record of records) {
  const name = record.taxon?.vernacularName ?? record.taxon?.scientificName
  const count = Number(record.occurrence?.individualCount) || 0
  if (count === 0) withoutCount.push(name)
  individuals += count
  bySpecies.set(name, (bySpecies.get(name) ?? 0) + count)
}

console.log(`Date: ${date}`)
console.log(`Sightings: ${records.length} of ${total}, species: ${bySpecies.size}, individuals: ${individuals}`)
console.log(`Without a count: ${withoutCount.join(", ") || "none"}`)
console.log("\nBy species:")
for (const [name, count] of [...bySpecies].sort((a, b) => b[1] - a[1])) console.log(`${count}\t${name}`)
console.log("\nSightings:")
const byTime = records.toSorted((a, b) => a.event.startDate.localeCompare(b.event.startDate))
for (const record of byTime) {
  const time = new Date(record.event.startDate).toLocaleTimeString("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" })
  console.log([time, record.taxon?.vernacularName, record.location?.locality, record.occurrence?.individualCount].join(" | "))
}
