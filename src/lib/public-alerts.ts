import {
  ALERT_SELECT,
  type AlertRow,
  PROFILE_SELECT,
  type PublicAlert,
  toPublicAlert,
} from "./alert-dto"
import { type AlertCursor, newerThan, olderThan } from "./alert-keyset"
import { observerIndex, observerName } from "./alert-observer"
import { coarsePlace, type NamedLocation } from "./alert-place"
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

async function loadLocations(backend: AlertsBackend): Promise<LarmResult<NamedLocation[]>> {
  const { data, error } = await backend.db
    .from("locations")
    .select("name, latitude, longitude")
    .limit(REFERENCE_LIMIT)
  if (error) {
    console.error(`mafk-web: load lokaler failed — ${error.message}`)
    return failed
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

type Context = { hidden: string[]; locations: NamedLocation[]; observers: Map<string, string> }

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

const cursorOf = (alert: PublicAlert): AlertCursor => ({ sentAt: alert.sentAt, id: alert.id })

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
    .order("sent_at", { ascending })
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
  const last = alerts[alerts.length - 1]
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
  signal?: AbortSignal
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
    return { ok: true, value: await backend.value.fetchUpload(path, { signal }) }
  } catch {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError")
    console.error("mafk-web: larm photo — storage unreachable")
    return failed
  }
}
