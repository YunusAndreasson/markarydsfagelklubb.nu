import type { APIRoute } from "astro"
import { LOGIN_PATH } from "@/lib/admin-access"

export const prerender = false

/**
 * POST-only on purpose: a GET sign-out can be fired by any third-party page
 * that embeds an <img> pointing at this URL.
 *
 * Local scope: the admin's account is an ordinary app account, and the default
 * (global) would revoke every session it has, signing the admin out of the
 * app on their phone too.
 */
export const POST: APIRoute = async ({ locals, redirect }) => {
  await locals.supabase?.auth.signOut({ scope: "local" })
  return redirect(LOGIN_PATH, 303)
}

export const ALL: APIRoute = () =>
  new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } })
