import { stockholmYear, toStockholmInputValue } from "@/lib/stockholm-time"
import {
  aggregateYear,
  mergeHistory,
  mergeNames,
  type NameMap,
  summarise,
  toSighting,
} from "./aggregate"
import type { Client } from "./client"
import { type Kv, store } from "./store"
import type { Meta } from "./types"

/**
 * The two scheduled jobs (wrangler.jsonc `triggers.crons`, `src/worker.ts`).
 *
 * SOS allows about 50–60 calls a minute and answers 429 above that. A job
 * never waits that out: it saves how far it got and the next run carries on.
 * Everything a page reads is written whole, so a page sees the old value or
 * the new one, never half.
 */

export const FAST_CRON = "*/30 * * * *"
export const NIGHTLY_CRON = "17 3 * * *"

/** How far back "Senaste fynden" reaches, and how many it keeps. */
export const RECENT_DAYS = 30
export const RECENT_MAX = 400
/** Past years refreshed per night: all of history about once a week. */
export const YEARS_PER_NIGHT = 8
/** Names looked up one by one per night, for taxa no scanned year has named yet. */
const NAME_LOOKUPS_PER_NIGHT = 15

const EMPTY_META: Meta = { cursor: null, lastFast: null, lastNightly: null, lastError: null }

export type JobResult =
  | { ok: true; calls: number; note?: string }
  | { ok: false; calls: number; error: string }

function today(now: Date): string {
  return toStockholmInputValue(now).slice(0, 10)
}

function daysBefore(date: string, days: number): string {
  const instant = Date.parse(`${date}T12:00:00Z`) - days * 86_400_000
  return new Date(instant).toISOString().slice(0, 10)
}

async function refreshYear(
  kv: Kv,
  client: Client,
  year: number,
  fetchedAt: string,
  names: NameMap | null
) {
  const stats = aggregateYear(year, await client.year(year), fetchedAt)
  await store.writeYear(kv, stats)
  await store.writeHistory(
    kv,
    mergeHistory(await store.readHistory(kv), summarise(stats), fetchedAt)
  )
  return mergeNames(names, stats.species)
}

async function fail(kv: Kv, meta: Meta, client: Client, error: unknown): Promise<JobResult> {
  const message = error instanceof Error ? error.message : String(error)
  await store.writeMeta(kv, { ...meta, lastError: `${new Date().toISOString()} ${message}` })
  return { ok: false, calls: client.calls, error: message }
}

/** Every half hour: the newest sightings and the current year. About six calls. */
export async function runFast(kv: Kv, client: Client, now = new Date()): Promise<JobResult> {
  const meta = (await store.readMeta(kv)) ?? EMPTY_META
  const fetchedAt = now.toISOString()
  try {
    const to = today(now)
    const records = await client.recent(daysBefore(to, RECENT_DAYS - 1), to)
    await store.writeRecent(kv, {
      fetchedAt,
      days: RECENT_DAYS,
      sightings: records.slice(0, RECENT_MAX).map(toSighting),
    })
    const names = await refreshYear(
      kv,
      client,
      stockholmYear(now),
      fetchedAt,
      await store.readNames(kv)
    )
    await store.writeNames(kv, names)
    await store.writeMeta(kv, { ...meta, lastFast: fetchedAt, lastError: null })
    return { ok: true, calls: client.calls }
  } catch (error) {
    return fail(kv, meta, client, error)
  }
}

/**
 * Every night: the all-time list, then a window of past years, newest first,
 * wrapping round to last year once it reaches the first recorded year.
 */
export async function runNightly(
  kv: Kv,
  client: Client,
  now = new Date(),
  yearsPerRun = YEARS_PER_NIGHT
): Promise<JobResult> {
  let meta = (await store.readMeta(kv)) ?? EMPTY_META
  const fetchedAt = now.toISOString()
  const thisYear = stockholmYear(now)
  let names = await store.readNames(kv)
  try {
    const taxa = await client.allTime()
    await store.writeAllTime(kv, {
      fetchedAt,
      taxa: taxa.map((one) => ({
        id: one.taxonId,
        first: one.firstSighting.slice(0, 10),
        last: one.lastSighting.slice(0, 10),
        reports: one.observationCount,
      })),
    })
    const earliest = Number(
      taxa
        .map((one) => one.firstSighting)
        .sort()[0]
        ?.slice(0, 4) ?? thisYear
    )

    let year =
      meta.cursor && meta.cursor < thisYear && meta.cursor >= earliest ? meta.cursor : thisYear - 1
    for (let done = 0; done < yearsPerRun && year >= earliest; done++) {
      names = await refreshYear(kv, client, year, fetchedAt, names)
      await store.writeNames(kv, names)
      year = year - 1 < earliest ? thisYear - 1 : year - 1
      meta = { ...meta, cursor: year }
      await store.writeMeta(kv, meta)
    }

    // A taxon in the all-time list that no scanned year has named yet.
    const unnamed = taxa.filter((one) => !names?.[one.taxonId]).slice(0, NAME_LOOKUPS_PER_NIGHT)
    for (const one of unnamed) {
      const record = await client.nameOf(one.taxonId)
      const sci = record?.taxon.scientificName?.trim() ?? ""
      const name = record?.taxon.vernacularName?.trim() || sci
      if (name) names = mergeNames(names, [{ id: one.taxonId, name, sci }])
    }
    if (names) await store.writeNames(kv, names)

    await store.writeMeta(kv, { ...meta, lastNightly: fetchedAt, lastError: null })
    return { ok: true, calls: client.calls, note: `cursor now ${meta.cursor}` }
  } catch (error) {
    // A rate limit is expected: the cursor stays where it stopped and the next
    // night carries on. Any other failure is recorded in meta the same way.
    if (names) await store.writeNames(kv, names)
    return fail(kv, meta, client, error)
  }
}
