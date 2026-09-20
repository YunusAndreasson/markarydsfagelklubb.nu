import type { WriteResult } from "./admin-content"
import {
  ALERT_SELECT,
  type AlertRow,
  PROFILE_SELECT,
  type PublicAlert,
  toPublicAlert,
} from "./alert-dto"
import { observerIndex, observerName } from "./alert-observer"
import { coarsePlace, type NamedLocation } from "./alert-place"
import type { SupabaseServerClient } from "./supabase-server"

/**
 * The administrator's view of the larm feed, and the one thing they can do to
 * it: take a larm off the website.
 *
 * It reads with the **admin's own session**, not the secret key. `alerts`,
 * `locations` and `profiles` are all readable by `authenticated`, so this
 * screen needs no RLS bypass at all and the secret key stays confined to the
 * public `/larm*` routes.
 *
 * It shows the same coarse place and the same resolved name the public sees,
 * so the administrator judges the larm as published rather than as stored —
 * and no coordinate reaches the admin page either.
 */

export const ADMIN_ALERT_LIMIT = 100

export type AdminAlert = PublicAlert & { hidden: boolean; reason: string }

export async function listAdminAlerts(
  supabase: SupabaseServerClient,
  limit = ADMIN_ALERT_LIMIT
): Promise<AdminAlert[] | null> {
  const [alerts, locations, profiles, hidden] = await Promise.all([
    supabase
      .from("alerts")
      .select(ALERT_SELECT)
      .order("sent_at", { ascending: false })
      .limit(limit)
      .overrideTypes<AlertRow[], { merge: false }>(),
    supabase.from("locations").select("name, latitude, longitude").limit(1000),
    supabase.from("profiles").select(PROFILE_SELECT).limit(1000),
    supabase.from("hidden_alerts").select("alert_id, reason").limit(1000),
  ])

  const failure = alerts.error ?? locations.error ?? profiles.error ?? hidden.error
  if (failure) {
    console.error(`mafk-web: admin list larm failed — ${failure.message}`)
    return null
  }

  // Every error was handled above, so the `?? []` are only to satisfy the
  // response type, which pairs `data: null` with `error: null` structurally.
  const named: NamedLocation[] = locations.data ?? []
  const observers = observerIndex(profiles.data ?? [])
  const reasons = new Map((hidden.data ?? []).map((row) => [row.alert_id, row.reason ?? ""]))

  return (alerts.data ?? []).map((row) => ({
    ...toPublicAlert(row, coarsePlace(row, named), observerName(row.observer_user_id, observers)),
    hidden: reasons.has(row.id),
    reason: reasons.get(row.id) ?? "",
  }))
}

const UNIQUE_VIOLATION = "23505"

/**
 * Take a larm off the website.
 *
 * An insert, not an upsert: `hidden_alerts` grants no UPDATE and has no update
 * policy, because hiding is an insert and showing again is a delete — there is
 * no third state to edit. A larm that is already hidden therefore comes back
 * as a duplicate key, which is success as far as the administrator is
 * concerned, so a double submit changes nothing and reports nothing.
 */
export async function hideAlert(
  supabase: SupabaseServerClient,
  id: string,
  reason: string,
  hiddenBy: string | null
): Promise<WriteResult> {
  const { error } = await supabase
    .from("hidden_alerts")
    .insert({ alert_id: id, reason, hidden_by: hiddenBy })
  if (error && error.code !== UNIQUE_VIOLATION) {
    console.error(`mafk-web: hide larm failed — ${error.code} ${error.message}`)
    return { ok: false, reason: "failed" }
  }
  return { ok: true, value: null }
}

/** Put it back. */
export async function showAlert(supabase: SupabaseServerClient, id: string): Promise<WriteResult> {
  const { error } = await supabase.from("hidden_alerts").delete().eq("alert_id", id)
  if (error) {
    console.error(`mafk-web: show larm failed — ${error.code} ${error.message}`)
    return { ok: false, reason: "failed" }
  }
  return { ok: true, value: null }
}
