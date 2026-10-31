import {
  ALERT_SELECT,
  type AlertRow,
  PROFILE_SELECT,
  type PublicAlert,
  toPublicAlert,
} from "./alert-dto"
import { type AlertCursor, newerThan, olderThan } from "./alert-keyset"
import { observerIndex, observerName } from "./alert-observer"
import type { PhotoTransform } from "./alert-photo"
import { coarsePlace } from "./alert-place"
import {
  buildLokaler,
  byName,
  findLokal,
  type Lokal,
  type LokalRow,
  type LokalSummary,
} from "./lokal"
import { classifyForLokal, type LarmPoint, lokalActivity, nearBox } from "./lokal-alerts"
import { type AlertsBackend, openAlertsBackend } from "./supabase-secret"

/**
 * What the public larm pages read (docs/roadmap.md, F4).
 *
 * **This is the only module that imports `supabase-secret.ts`.** The pages ask
 * it for larm and get {@link PublicAlert} values back; they never hold the
 * RLS-bypassing client, and a raw row never leaves this file. The curation
 * itself lives in `alert-dto.ts`, `alert-place.ts` and `alert-observer.ts`,
 * each pure and tested — this file only fetches and stitches.
 *
 * A page costs two round trips, not four: the hidden list, the lokaler and the
 * observers depend on neither each other nor the larm, so they go together and
 * the larm query follows.
 */

/** Supabase caps a response at 1000 rows; all three reads are far below it. */
const REFERENCE_LIMIT = 1000

/** `ok: false` always means "logged, and the page should say so" — never "empty". */
export type LarmResult<T> = { ok: true; value: T } | { ok: false }

const failed = { ok: false } as const

function open(): LarmResult<AlertsBackend> {
  const opened = openAlertsBackend()
  if (!opened.ok) {
    // Name the values in the log, never in a response body.
    console.error(`mafk-web: larm_unavailable — ${opened.problems.join("; ")}`)
    return failed
  }
  return { ok: true, value: opened.backend }
}

/**
 * The larm the administrator has taken off the website.
 *
 * Passed to PostgREST as `not.in`, which is right for the tens of rows this
 * will ever hold. Were it to reach the hundreds the query string would get
 * unwieldy and this should become a join; the cap below makes that loud rather
 * than silent.
 */
async function loadHiddenIds(backend: AlertsBackend): Promise<LarmResult<string[]>> {
  const { data, error } = await backend.db
    .from("hidden_alerts")
    .select("alert_id")
    .limit(REFERENCE_LIMIT)
  if (error) {
    console.error(`mafk-web: load hidden larm failed — ${error.message}`)
    return failed
  }
  if (data.length === REFERENCE_LIMIT) {
    console.error("mafk-web: hidden larm hit the row cap; the not.in filter needs replacing")
  }
  return { ok: true, value: data.map((row) => row.alert_id) }
}

/**
 * The club's 61 lokaler, whole.
 *
 * Wider than the place ladder strictly needs (which only wants a name and a
 * point) because step 6 gives every lokal a page, and a second read of the
 * same 61 rows on the same request would buy nothing. Nothing here is member
 * data: a lokal is a public place name, a position and the club's own
 * description of it.
 */
async function loadLocations(backend: AlertsBackend): Promise<LarmResult<LokalRow[]>> {
  const { data, error } = await backend.db
    .from("locations")
    .select("id, name, latitude, longitude, description")
    .limit(REFERENCE_LIMIT)
  if (error) {
    console.error(`mafk-web: load lokaler failed — ${error.message}`)
    return failed
  }
  if (data.length === REFERENCE_LIMIT) {
    console.error("mafk-web: lokaler hit the row cap; the lokal read needs paging")
  }
  return { ok: true, value: data }
}

/**
 * Every member's display name, as one small map.
 *
 * Fetched whole (46 rows, two columns) rather than per page of larm, so it
 * needn't wait for the larm query. Names are always resolved live — see
 * `alert-observer.ts` for why `alerts.observer_name` must not be used.
 */
async function loadObservers(backend: AlertsBackend): Promise<LarmResult<Map<string, string>>> {
  const { data, error } = await backend.db
    .from("profiles")
    .select(PROFILE_SELECT)
    .limit(REFERENCE_LIMIT)
  if (error) {
    console.error(`mafk-web: load observers failed — ${error.message}`)
    return failed
  }
  if (data.length === REFERENCE_LIMIT) {
    console.error("mafk-web: profiles hit the row cap; the observer lookup needs paging")
  }
  return { ok: true, value: observerIndex(data) }
}

type Context = { hidden: string[]; locations: LokalRow[]; observers: Map<string, string> }

async function loadContext(backend: AlertsBackend): Promise<LarmResult<Context>> {
  const [hidden, locations, observers] = await Promise.all([
    loadHiddenIds(backend),
    loadLocations(backend),
    loadObservers(backend),
  ])
  if (!hidden.ok || !locations.ok || !observers.ok) return failed
  return {
    ok: true,
    value: { hidden: hidden.value, locations: locations.value, observers: observers.value },
  }
}

function publish(row: AlertRow, context: Context): PublicAlert {
  return toPublicAlert(
    row,
    coarsePlace(row, context.locations),
    observerName(row.observer_user_id, context.observers)
  )
}

/** `not.in` needs the list parenthesised; uuids need no quoting. */
const notIn = (ids: readonly string[]) => `(${ids.join(",")})`

export type AlertPage = {
  alerts: PublicAlert[]
  /** Cursor for the next, older page, if there is one. */
  older: AlertCursor | null
  /** Cursor for the previous, newer page, if this isn't the first. */
  newer: AlertCursor | null
}

const cursorOf = (alert: PublicAlert): AlertCursor => ({
  observedAt: alert.observedAt,
  id: alert.id,
})

/**
 * A page of larm, newest first. `before` pages towards older larm, `after`
 * back towards newer ones — the same shape as `listPublishedArticles`.
 */
export async function listPublicAlerts(options: {
  limit: number
  before?: AlertCursor | null
  after?: AlertCursor | null
}): Promise<LarmResult<AlertPage>> {
  const { limit, before, after } = options
  const backend = open()
  if (!backend.ok) return failed
  const context = await loadContext(backend.value)
  if (!context.ok) return failed

  // Paging back towards newer larm reads ascending, then flips.
  const ascending = Boolean(after && !before)
  let query = backend.value.db.from("alerts").select(ALERT_SELECT)
  if (context.value.hidden.length > 0) query = query.not("id", "in", notIn(context.value.hidden))
  if (before) query = query.or(olderThan(before))
  else if (after) query = query.or(newerThan(after))

  const { data, error } = await query
    .order("observed_at", { ascending })
    .order("id", { ascending })
    .limit(limit + 1)
    .overrideTypes<AlertRow[], { merge: false }>()
  if (error) {
    console.error(`mafk-web: list larm failed — ${error.message}`)
    return failed
  }

  const hasMore = data.length > limit
  const rows = data.slice(0, limit).map((row) => publish(row, context.value))
  const alerts = ascending ? rows.reverse() : rows
  const first = alerts[0]
  const last = alerts.at(-1)
  return {
    ok: true,
    value: {
      alerts,
      older: (ascending ? Boolean(after) : hasMore) && last ? cursorOf(last) : null,
      newer: (ascending ? hasMore : Boolean(before)) && first ? cursorOf(first) : null,
    },
  }
}

/** One larm, or null when it doesn't exist or has been hidden. */
export async function loadPublicAlert(id: string): Promise<LarmResult<PublicAlert | null>> {
  const backend = open()
  if (!backend.ok) return failed
  const context = await loadContext(backend.value)
  if (!context.ok) return failed
  // A hidden larm is indistinguishable from one that never existed.
  if (context.value.hidden.includes(id)) return { ok: true, value: null }

  const { data, error } = await backend.value.db
    .from("alerts")
    .select(ALERT_SELECT)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<AlertRow | null, { merge: false }>()
  if (error) {
    console.error(`mafk-web: load larm failed — ${error.message}`)
    return failed
  }
  return { ok: true, value: data ? publish(data, context.value) : null }
}

/**
 * Written by the app under `${uid}/…`. Validated anyway before it becomes a
 * URL: a traversal here would read some other object out of the bucket.
 */
const SAFE_OBJECT_PATH = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*){1,4}$/

/**
 * The upstream response for a larm's photo, for the photo route alone.
 *
 * `value: null` means "no picture to serve" — no such larm, a hidden one, a
 * report without a photo, or a path that doesn't look like one the app wrote.
 * The route turns all of those into the same 404.
 *
 * The storage path never leaves this function: the caller gets bytes, and the
 * path stays here because it contains the member's user id.
 */
export async function openAlertPhoto(
  id: string,
  signal?: AbortSignal,
  transform?: PhotoTransform
): Promise<LarmResult<Response | null>> {
  const backend = open()
  if (!backend.ok) return failed

  const [hidden, alert] = await Promise.all([
    backend.value.db.from("hidden_alerts").select("alert_id").eq("alert_id", id).maybeSingle(),
    backend.value.db
      .from("alerts")
      .select("id, observation:observations(image_path)")
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<
        { id: string; observation: { image_path: string | null } | null } | null,
        {
          merge: false
        }
      >(),
  ])
  if (hidden.error || alert.error) {
    console.error(
      `mafk-web: larm photo lookup failed — ${(hidden.error ?? alert.error)?.message ?? "unknown"}`
    )
    return failed
  }
  if (hidden.data) return { ok: true, value: null }

  const path = alert.data?.observation?.image_path ?? null
  if (!path || !SAFE_OBJECT_PATH.test(path)) return { ok: true, value: null }

  try {
    if (transform) {
      const resized = await backend.value.fetchUpload(path, { signal, transform })
      if (resized.ok) return { ok: true, value: resized }
      // An HTTP error from the resizer — transformations switched off, say —
      // still has the original to fall back on. A throw or a timeout does
      // not get a second try: two storage deadlines back to back is longer
      // than anyone waits for a photo.
      await resized.body?.cancel()
      console.error(`mafk-web: larm photo — render ${resized.status}, serving original`)
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError")
    }
    return { ok: true, value: await backend.value.fetchUpload(path, { signal }) }
  } catch {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError")
    console.error("mafk-web: larm photo — storage unreachable")
    return failed
  }
}

/**
 * Everything the lokal pages need to read (docs/roadmap.md, F5).
 *
 * The larm feed pages, so it never asks for more than twelve rows. A lokal
 * page can't: to say how many larm a lokal has had, or which of them are
 * within 300 m, you have to have looked at all of them. Supabase caps a
 * response at 1000 rows and the club sends roughly 500 larm a year, so a plain
 * `.limit(1000)` would quietly start undercounting in about eighteen months.
 * {@link sweepAlerts} walks the same `(observed_at, id)` keyset the feed uses
 * instead, and says so loudly if it ever hits the ceiling below.
 */

/** Ten pages is two decades of larm at the current rate — and a bug if reached. */
const MAX_SWEEP_PAGES = 10
const SWEEP_PAGE_SIZE = 1000

/** The lean row the map's tally needs: no species, no observer, no photo. */
const LARM_POINT_SELECT = "id, sent_at, observed_at, latitude, longitude, location_id"

type SweptPoint = LarmPoint & { id: string; observed_at: string | null }

/** A box to narrow on server-side before the real circular test runs. */
type SweepBox = { minLat: number; maxLat: number; minLng: number; maxLng: number }

type SweepOptions = {
  /** Only larm inside this box. Omitted, the sweep reads every larm. */
  box?: SweepBox | null
  /**
   * Also fetch larm that name this lokal, wherever they are. A reporter can
   * pick a lokal from well outside the box, and their answer outranks the
   * coordinate (see `lokal-alerts.ts`).
   */
  locationId?: number | null
}

/**
 * Every larm matching `options`, oldest page last, hidden larm excluded.
 *
 * `select` decides how much of each row comes back, so the map's tally reads
 * five columns and a lokal page reads the full {@link ALERT_SELECT}.
 */
async function sweepAlerts<T extends { id: string; sent_at: string; observed_at: string | null }>(
  backend: AlertsBackend,
  select: string,
  hidden: readonly string[],
  options: SweepOptions = {}
): Promise<LarmResult<T[]>> {
  const rows: T[] = []
  const seen = new Set<string>()
  let cursor: AlertCursor | null = null

  for (let page = 0; page < MAX_SWEEP_PAGES; page++) {
    let query = backend.db.from("alerts").select(select)
    if (hidden.length > 0) query = query.not("id", "in", notIn(hidden))
    if (options.box) {
      query = query
        .gte("latitude", options.box.minLat)
        .lte("latitude", options.box.maxLat)
        .gte("longitude", options.box.minLng)
        .lte("longitude", options.box.maxLng)
    }
    if (cursor) query = query.or(olderThan(cursor))

    const { data, error } = await query
      .order("observed_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(SWEEP_PAGE_SIZE)
      .overrideTypes<T[], { merge: false }>()
    if (error) {
      console.error(`mafk-web: sweep larm failed — ${error.message}`)
      return failed
    }

    for (const row of data) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      rows.push(row)
    }
    if (data.length < SWEEP_PAGE_SIZE) return { ok: true, value: await withNamed() }

    const last = data.at(-1)
    if (!last) return { ok: true, value: await withNamed() }
    cursor = { observedAt: last.observed_at ?? last.sent_at, id: last.id }
  }

  console.error(
    `mafk-web: larm sweep stopped at ${MAX_SWEEP_PAGES * SWEEP_PAGE_SIZE} rows; lokal tallies are now short`
  )
  return { ok: true, value: await withNamed() }

  /**
   * The larm that named this lokal but fall outside the box. A separate query
   * rather than an `or()` branch on every page: there are 21 such larm in the
   * whole log, and keeping the paged query free of nested `or` keeps the
   * keyset filter the only one.
   */
  async function withNamed(): Promise<T[]> {
    if (options.locationId === null || options.locationId === undefined) return rows
    let named = backend.db.from("alerts").select(select).eq("location_id", options.locationId)
    if (hidden.length > 0) named = named.not("id", "in", notIn(hidden))
    const { data, error } = await named
      .order("observed_at", { ascending: false })
      .limit(SWEEP_PAGE_SIZE)
      .overrideTypes<T[], { merge: false }>()
    if (error) {
      // The box already holds all but a handful; a lokal page short by one
      // outlying larm beats a 503.
      console.error(`mafk-web: named-lokal larm failed — ${error.message}`)
      return rows
    }
    for (const row of data) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      rows.push(row)
    }
    return rows
  }
}

/**
 * The club's lokaler with their larm tally, in Swedish alphabetical order —
 * the register under the map, and the pins on it.
 *
 * Carries no member data whatsoever: a name, the club's own position for it,
 * how many larm it has had and when the last one was.
 */
export async function listPublicLokaler(
  now: Date = new Date()
): Promise<LarmResult<LokalSummary[]>> {
  const backend = open()
  if (!backend.ok) return failed

  const hidden = await loadHiddenIds(backend.value)
  if (!hidden.ok) return failed
  const [locations, points] = await Promise.all([
    loadLocations(backend.value),
    sweepAlerts<SweptPoint>(backend.value, LARM_POINT_SELECT, hidden.value),
  ])
  if (!locations.ok || !points.ok) return failed

  // Every larm is assigned to one lokal at most, so the tallies partition the
  // log instead of counting the same evening at three neighbouring lokaler.
  const all = buildLokaler(locations.value)
  const lokaler = all
    .map((lokal) => ({ ...lokal, ...lokalActivity(lokal, points.value, all, now) }))
    .sort(byName)
  return { ok: true, value: lokaler }
}

export type PublicLokal = {
  lokal: Lokal
  /** Larm the app would also place here: within 300 m, or named by the reporter. */
  at: PublicAlert[]
  /** The rest of the three-kilometre band — the larm the feed labels "Nära …". */
  near: PublicAlert[]
}

/** One lokal with its larm, or null when no lokal has that slug. */
export async function loadPublicLokal(slug: string): Promise<LarmResult<PublicLokal | null>> {
  const backend = open()
  if (!backend.ok) return failed
  const context = await loadContext(backend.value)
  if (!context.ok) return failed

  const lokaler = buildLokaler(context.value.locations)
  const lokal = findLokal(slug, lokaler)
  if (!lokal) return { ok: true, value: null }

  const rows = await sweepAlerts<AlertRow>(backend.value, ALERT_SELECT, context.value.hidden, {
    box: nearBox(lokal),
    locationId: lokal.id,
  })
  if (!rows.ok) return failed

  const at: PublicAlert[] = []
  const near: PublicAlert[] = []
  for (const row of rows.value) {
    const relation = classifyForLokal(lokal, row, lokaler)
    if (relation === "elsewhere") continue
    ;(relation === "at" ? at : near).push(publish(row, context.value))
  }
  const newestFirst = (a: PublicAlert, b: PublicAlert) => (a.observedAt < b.observedAt ? 1 : -1)
  return { ok: true, value: { lokal, at: at.sort(newestFirst), near: near.sort(newestFirst) } }
}
