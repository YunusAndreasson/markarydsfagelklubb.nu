import { stockholmYear, toStockholmInputValue } from "@/lib/stockholm-time"
import {
  aggregateYear,
  mergeHistory,
  mergeNames,
  type NameMap,
  speciesNames,
  summarise,
  toSighting,
  unnamedSpecies,
} from "./aggregate"
import type { Client } from "./client"
import { type Kv, store } from "./store"
import { allTimeFromIndex, buildSeason, mergeTaxa, needsRebuild, rebuildTaxa } from "./taxa"
import type { Meta, SosRecord, YearStats } from "./types"

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

/**
 * Names the species that the records count for only through a subspecies
 * (a year with gråkråka but no plain kråka), one lookup each, once: the name
 * stays in the map.
 */
async function nameSpecies(
  client: Client,
  records: readonly SosRecord[],
  names: NameMap | null
): Promise<NameMap | null> {
  let next = names
  for (const id of unnamedSpecies(records, names)) {
    const record = await client.nameOf(id)
    const sci = record?.taxon.scientificName?.trim() ?? ""
    const name = record?.taxon.vernacularName?.trim() || sci
    if (name) next = mergeNames(next, [{ id, name, sci }])
  }
  return next
}

async function refreshYear(
  kv: Kv,
  client: Client,
  year: number,
  fetchedAt: string,
  known: NameMap | null
) {
  const records = await client.year(year)
  const names = await nameSpecies(client, records, known)
  const stats = aggregateYear(year, records, fetchedAt, names)
  await store.writeYear(kv, stats)
  await store.writeHistory(
    kv,
    mergeHistory(await store.readHistory(kv), summarise(stats), fetchedAt)
  )
  // The species pages' index (taxa.ts): this year's line replaces itself.
  const index = mergeTaxa(await store.readTaxa(kv), stats, fetchedAt)
  await store.writeTaxa(kv, index)
  // The all-time list follows the index, so it counts subspecies as their species.
  await store.writeAllTime(kv, allTimeFromIndex(index, fetchedAt))
  return mergeNames(names, stats.species)
}

/**
 * Build the species index from the year keys already in KV when it lacks a
 * year that the history has — the first night after it was introduced, or if
 * the key is ever lost. KV reads only: no API calls, so no rate limit.
 */
async function backfillTaxa(kv: Kv, fetchedAt: string): Promise<void> {
  const history = await store.readHistory(kv)
  const years = history?.years.map((one) => one.year) ?? []
  if (!needsRebuild(await store.readTaxa(kv), years)) return
  const stats = await Promise.all(years.map((year) => store.readYear(kv, year)))
  const present = stats.filter((one): one is YearStats => one !== null)
  await store.writeTaxa(kv, rebuildTaxa(present, fetchedAt))
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
    const names = await refreshYear(
      kv,
      client,
      stockholmYear(now),
      fetchedAt,
      await store.readNames(kv)
    )
    await store.writeNames(kv, names)
    // After the year, whose lookups named every species these records count for.
    const named = speciesNames(records, names)
    await store.writeRecent(kv, {
      fetchedAt,
      days: RECENT_DAYS,
      sightings: records.slice(0, RECENT_MAX).flatMap((record) => toSighting(record, named) ?? []),
    })
    await store.writeMeta(kv, { ...meta, lastFast: fetchedAt, lastError: null })
    return { ok: true, calls: client.calls }
  } catch (error) {
    return fail(kv, meta, client, error)
  }
}

/**
 * Every night: a window of past years, newest first, wrapping round to last
 * year once it reaches the first recorded year.
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
    // Only for how far back the years go; the list itself comes from the index.
    const taxa = await client.allTime()
    const earliest = Number(
      taxa
        .map((one) => one.firstSighting)
        .sort()[0]
        ?.slice(0, 4) ?? thisYear
    )

    await backfillTaxa(kv, fetchedAt)
    // The index names every taxon any stored year has seen, so a species page
    // exists for each the first night, not after the cursor has walked back
    // through every year at YEARS_PER_NIGHT a night. Only missing names: a
    // refreshed year's own name is as new or newer.
    const indexed = await store.readTaxa(kv)
    if (indexed) {
      names = mergeNames(
        names,
        Object.entries(indexed.taxa)
          .filter(([id]) => !names?.[Number(id)])
          .map(([id, one]) => ({ id: Number(id), name: one.name, sci: one.sci }))
      )
      await store.writeNames(kv, names)
      await store.writeAllTime(kv, allTimeFromIndex(indexed, fetchedAt))
    }

    let year =
      meta.cursor && meta.cursor < thisYear && meta.cursor >= earliest ? meta.cursor : thisYear - 1
    for (let done = 0; done < yearsPerRun && year >= earliest; done++) {
      names = await refreshYear(kv, client, year, fetchedAt, names)
      await store.writeNames(kv, names)
      year = year - 1 < earliest ? thisYear - 1 : year - 1
      meta = { ...meta, cursor: year }
      await store.writeMeta(kv, meta)
    }

    // "Usually" only moves with past years, so once a night is enough.
    const taxaIndex = await store.readTaxa(kv)
    if (taxaIndex) await store.writeSeason(kv, buildSeason(taxaIndex, thisYear, fetchedAt))

    await store.writeMeta(kv, { ...meta, lastNightly: fetchedAt, lastError: null })
    return { ok: true, calls: client.calls, note: `cursor now ${meta.cursor}` }
  } catch (error) {
    // A rate limit is expected: the cursor stays where it stopped and the next
    // night carries on. Any other failure is recorded in meta the same way.
    if (names) await store.writeNames(kv, names)
    return fail(kv, meta, client, error)
  }
}
