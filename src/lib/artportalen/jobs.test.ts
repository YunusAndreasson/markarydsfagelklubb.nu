import { describe, expect, it } from "vitest"
import { type Client, RateLimited } from "./client"
import { runFast, runNightly } from "./jobs"
import { type Kv, store } from "./store"
import type { SosRecord } from "./types"

function memoryKv(): Kv & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    async get(key) {
      const value = data.get(key)
      return value === undefined ? null : JSON.parse(value)
    },
    async put(key, value) {
      data.set(key, value)
    },
  }
}

const sighting = (date: string, id = 1, name = "koltrast"): SosRecord => ({
  taxon: { id, vernacularName: name, scientificName: "Turdus merula" },
  occurrence: { recordedBy: "Anna A", individualCount: "1" },
  event: { startDate: `${date}T08:00:00+01:00` },
})

/** A client over a fixed set of years; `limitAfter` calls, it starts answering 429. */
function fakeClient(years: Record<number, SosRecord[]>, limitAfter = Number.POSITIVE_INFINITY) {
  let calls = 0
  const count = () => {
    calls++
    if (calls > limitAfter) throw new RateLimited(41)
  }
  const client = {
    get calls() {
      return calls
    },
    async year(year: number) {
      count()
      return years[year] ?? []
    },
    async recent() {
      count()
      return [sighting("2026-11-13")]
    },
    async allTime() {
      count()
      return [
        {
          taxonId: 1,
          observationCount: 9,
          firstSighting: "2020-04-01T08:00:00+01:00",
          lastSighting: "2026-11-13T08:00:00+01:00",
        },
        {
          taxonId: 7,
          observationCount: 1,
          firstSighting: "2021-05-01T08:00:00+01:00",
          lastSighting: "2021-05-01T08:00:00+01:00",
        },
      ]
    },
    async nameOf(taxonId: number) {
      count()
      return {
        taxon: { id: taxonId, vernacularName: "sällsynting", scientificName: "Rara avis" },
        event: { startDate: "" },
      }
    },
  }
  return client as unknown as Client
}

const NOW = new Date("2026-11-14T12:00:00Z")

describe("runFast", () => {
  it("writes recent sightings, the current year and its history line", async () => {
    const kv = memoryKv()
    const result = await runFast(
      kv,
      fakeClient({ 2026: [sighting("2026-01-02"), sighting("2026-11-13")] }),
      NOW
    )
    expect(result.ok).toBe(true)
    expect((await store.readRecent(kv))?.sightings).toHaveLength(1)
    expect((await store.readYear(kv, 2026))?.reports).toBe(2)
    expect((await store.readHistory(kv))?.years.map((one) => one.year)).toEqual([2026])
    expect((await store.readMeta(kv))?.lastFast).toBe(NOW.toISOString())
  })
})

describe("runNightly", () => {
  const years = {
    2020: [sighting("2020-04-01")],
    2021: [sighting("2021-05-01", 7, "")],
    2025: [sighting("2025-06-01")],
  }

  it("walks back from last year and wraps at the first recorded year", async () => {
    const kv = memoryKv()
    await runNightly(kv, fakeClient(years), NOW, 4)
    expect((await store.readMeta(kv))?.cursor).toBe(2021)
    await runNightly(kv, fakeClient(years), NOW, 4)
    // 2021 and 2020, then round to 2025 and 2024.
    expect((await store.readMeta(kv))?.cursor).toBe(2023)
    expect((await store.readHistory(kv))?.years.map((one) => one.year)).toEqual([2020, 2021, 2025])
    expect((await store.readAllTime(kv))?.taxa).toHaveLength(2)
  })

  it("names a taxon no scanned year named", async () => {
    const kv = memoryKv()
    await runNightly(kv, fakeClient({}), NOW, 0)
    expect((await store.readNames(kv))?.["7"]).toEqual({ name: "sällsynting", sci: "Rara avis" })
  })

  it("stops at a rate limit and keeps the cursor where it got to", async () => {
    const kv = memoryKv()
    // allTime and two years succeed, the third year call is refused.
    const result = await runNightly(kv, fakeClient(years, 3), NOW, 8)
    expect(result.ok).toBe(false)
    const meta = await store.readMeta(kv)
    expect(meta?.cursor).toBe(2023)
    expect(meta?.lastError).toMatch(/rate limit/)
    expect(meta?.lastNightly).toBeNull()
  })
})
