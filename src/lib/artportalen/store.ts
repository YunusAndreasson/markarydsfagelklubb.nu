import type { NameMap } from "./aggregate"
import type {
  AllTime,
  History,
  Meta,
  PastMonth,
  Recent,
  Season,
  TaxonIndex,
  YearStats,
} from "./types"

/**
 * The statistics live in KV (binding `OBSAR`), one JSON value per key. The
 * scheduled jobs write; the pages read. A missing key means "not built yet",
 * which every page shows as a calm notice rather than an error.
 */

/** The two calls the pages and jobs need, so tests and the seed script can stand in. */
export type Kv = {
  get(key: string, type: "json"): Promise<unknown>
  put(key: string, value: string): Promise<void>
}

const PREFIX = "ap:v1"

export const keys = {
  year: (year: number) => `${PREFIX}:year:${year}`,
  allTime: `${PREFIX}:alltime`,
  history: `${PREFIX}:history`,
  names: `${PREFIX}:names`,
  recent: `${PREFIX}:recent`,
  meta: `${PREFIX}:meta`,
  taxa: `${PREFIX}:taxa`,
  season: `${PREFIX}:season`,
  past: (month: number) => `${PREFIX}:past:${String(month).padStart(2, "0")}`,
} as const

async function read<T>(kv: Kv, key: string): Promise<T | null> {
  return ((await kv.get(key, "json")) as T | null) ?? null
}

function write(kv: Kv, key: string, value: unknown): Promise<void> {
  return kv.put(key, JSON.stringify(value))
}

export const store = {
  readYear: (kv: Kv, year: number) => read<YearStats>(kv, keys.year(year)),
  writeYear: (kv: Kv, stats: YearStats) => write(kv, keys.year(stats.year), stats),
  readAllTime: (kv: Kv) => read<AllTime>(kv, keys.allTime),
  writeAllTime: (kv: Kv, value: AllTime) => write(kv, keys.allTime, value),
  readHistory: (kv: Kv) => read<History>(kv, keys.history),
  writeHistory: (kv: Kv, value: History) => write(kv, keys.history, value),
  readNames: (kv: Kv) => read<NameMap>(kv, keys.names),
  writeNames: (kv: Kv, value: NameMap) => write(kv, keys.names, value),
  readRecent: (kv: Kv) => read<Recent>(kv, keys.recent),
  writeRecent: (kv: Kv, value: Recent) => write(kv, keys.recent, value),
  readMeta: (kv: Kv) => read<Meta>(kv, keys.meta),
  writeMeta: (kv: Kv, value: Meta) => write(kv, keys.meta, value),
  readTaxa: (kv: Kv) => read<TaxonIndex>(kv, keys.taxa),
  writeTaxa: (kv: Kv, value: TaxonIndex) => write(kv, keys.taxa, value),
  readSeason: (kv: Kv) => read<Season>(kv, keys.season),
  writeSeason: (kv: Kv, value: Season) => write(kv, keys.season, value),
  readPast: (kv: Kv, month: number) => read<PastMonth>(kv, keys.past(month)),
  writePast: (kv: Kv, value: PastMonth) => write(kv, keys.past(value.month), value),
}
