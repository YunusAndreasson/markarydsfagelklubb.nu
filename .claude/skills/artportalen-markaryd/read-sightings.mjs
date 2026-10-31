// Reads Markaryd kommun's public sightings for one day from Artportalen.
// Usage: node read-sightings.mjs [YYYY-MM-DD], default today in Sweden.
import { createRequire } from "node:module"

// Playwright isn't a dependency of this repo. edenmind-v2 has the Firefox build
// that is installed on this machine.
const require = createRequire("/home/yunus/Work/edenmind-v2/")
const { firefox } = require("playwright")

// Area 77 is Markaryd. Without a date the search covers the current month.
const SEARCH_URL = "https://www.artportalen.se/search/sightings/area/77"
const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"]

const date = process.argv[2] ?? new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" })
const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
if (!match) {
  console.error(`Expected YYYY-MM-DD, got ${date}`)
  process.exit(1)
}
const label = `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`

const browser = await firefox.launch()
const page = await browser.newPage()
const grids = []
page.on("response", async (response) => {
  if (!response.url().includes("GetSightingsGrid")) return
  const grid = await response.json().catch(() => null)
  if (grid) grids.push(grid)
})
await page.goto(SEARCH_URL, { waitUntil: "networkidle", timeout: 45000 })
const searchedRange = await page.locator("li.parameter").first().textContent()

// The table loads 50 rows a page. 300 is the largest size it offers. jQuery can
// arrive after network idle, so wait for it.
await page.waitForFunction(() => window.$?.fn?.DataTable, null, { timeout: 30000 })
await page.evaluate(() => window.$("#PublicSightingsTable").DataTable().page.len(300).draw())
await page.waitForTimeout(5000)
await browser.close()

const grid = grids.at(-1)
if (!grid) {
  console.error("No GetSightingsGrid response: the page may have changed.")
  process.exit(1)
}

const strip = (value) =>
  String(value ?? "")
    .replace(/<[^>]+>/g, "")
    .trim()

// Observers are deliberately never read: the answer needs no names of people.
const rows = grid.Data.map((row) => ({
  species: strip(row.TaxonName),
  scientific: strip(row.ScientificTaxonName),
  site: strip(row.SitePresentation),
  date: strip(row.FormattedDate),
  time: strip(row.FormattedTime),
  details: strip(row.SightingDescriptionHtml),
}))
const onDay = rows.filter((row) => row.date === label)

const bySpecies = new Map()
const withoutCount = []
let individuals = 0
for (const row of onDay) {
  const count = /^\d+(?=\s)/.exec(row.details)
  if (count) individuals += Number(count[0])
  else withoutCount.push(`${row.species}: ${row.details}`)
  bySpecies.set(row.species, (bySpecies.get(row.species) ?? 0) + (count ? Number(count[0]) : 0))
}

console.log(`Date: ${label}`)
console.log(`Range searched: ${searchedRange}`)
console.log(`Rows loaded: ${rows.length} of ${grid.TotalRowCount}`)
if (rows.length < grid.TotalRowCount) console.log("WARNING: not every row was loaded, the day may be incomplete.")
console.log(`Sightings: ${onDay.length}, species: ${bySpecies.size}, individuals: ${individuals}`)
console.log(`Without a leading count: ${withoutCount.join("; ") || "none"}`)
console.log("\nBy species:")
for (const [species, count] of [...bySpecies].sort((a, b) => b[1] - a[1])) console.log(`${count}\t${species}`)
console.log("\nSightings:")
for (const row of onDay) console.log([row.time, row.species, row.scientific, row.site, row.details].join(" | "))
