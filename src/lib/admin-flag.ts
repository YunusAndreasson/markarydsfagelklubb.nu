import type { SupabaseServerClient } from "./supabase-server"

/**
 * `profiles.is_admin` for this user, read with their own session. Signed-in
 * users may read profiles, including this column; only writing it is revoked
 * from clients, so the flag can only be granted through SQL.
 *
 * `null` means the lookup failed, which is not the same as "no": callers must
 * not show a working administrator a "not authorised" page because the
 * database hiccupped.
 */
export async function readIsAdmin(
  supabase: SupabaseServerClient,
  userId: string
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    console.error(`mafk-web: admin lookup failed — ${error.message}`)
    return null
  }
  return data?.is_admin === true
}
