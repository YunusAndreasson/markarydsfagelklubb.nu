/**
 * Who a larm is published as coming from.
 *
 * `alerts` carries `observer_name`, and using it would be the obvious thing to
 * do: it is right there on the row, it needs no join, and it is never null.
 * **It must not be used.** The alert log is a denormalized snapshot written
 * once by `send-bird-alert` and never touched again, so it keeps the name of a
 * member who has since deleted their account — while `observations` cascades
 * away with the account, as the app's delete-account function intends. Reading
 * the name from `alerts` would therefore keep publishing the name of someone
 * who asked to be erased.
 *
 * So the name is resolved through `profiles`, live, every time. A member who
 * leaves stops being named on the website the moment their profile goes, with
 * nothing to remember and nothing to clean up. `observer_name` is deliberately
 * not a parameter of anything here, so it cannot be used by accident.
 *
 * All 18 current observers still have a profile, which is exactly why this
 * would go unnoticed until the day it mattered.
 */

/** What the pages print when there is no name to publish. */
export const ANONYMOUS_OBSERVER = "En medlem"

export type ProfileName = { user_id: string; display_name: string | null }

/** `user_id → display_name`, for the handful of profiles a page of larm needs. */
export function observerIndex(profiles: readonly ProfileName[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const profile of profiles) {
    const name = profile.display_name?.trim()
    if (profile.user_id && name) index.set(profile.user_id, name)
  }
  return index
}

/**
 * The observer's display name, or null when there is none to publish — a
 * deleted account, a profile that failed to load, or a blank name.
 */
export function observerName(
  observerUserId: string | null | undefined,
  profiles: ReadonlyMap<string, string>
): string | null {
  if (!observerUserId) return null
  return profiles.get(observerUserId) ?? null
}
