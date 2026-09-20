import type { APIRoute } from "astro"
import { openAlertPhoto } from "@/lib/public-alerts"

export const prerender = false

/**
 * A larm's photo, streamed out of the app's **private** `user-uploads` bucket.
 *
 * Why a Worker route rather than a signed URL (docs/roadmap.md, D1): the
 * storage path contains the member's user id, so a signed URL would publish it
 * in the page — and would expire while a cached page still pointed at it.
 *
 * The body is never read here. `openAlertPhoto` resolves as soon as the
 * headers arrive, and the stream is handed straight to the visitor, so a 3 MB
 * JPEG costs no measurable CPU on the Workers free plan. Reading it into a
 * Blob — which `storage.download()` does — would buffer every byte instead.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Member uploads are all JPEG today; the other two are allowed for later. */
const ALLOWED_TYPES = new Set(["image/jpeg", "image/webp", "image/png"])

/**
 * Short on purpose. The bytes for a given larm never change, so this could be
 * hours — but hiding a larm has to reach browsers that already loaded the
 * page, and five minutes is the longest wait worth accepting for that.
 */
const PHOTO_CACHE_CONTROL = "public, max-age=300"

function plain(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  })
}

/**
 * One answer for every "no": a bad id, an unknown larm, a hidden larm, a
 * report without a picture and a missing object all 404 identically, so the
 * route can't be used to find out which larm the club has taken down.
 */
const notFound = () => plain("not_found", 404)
const unavailable = () => plain("larm_unavailable", 503)

export const GET: APIRoute = async ({ params, request }) => {
  const id = params.id
  if (!id || !UUID.test(id)) return notFound()

  let photo: Awaited<ReturnType<typeof openAlertPhoto>>
  try {
    photo = await openAlertPhoto(id, request.signal)
  } catch {
    // The visitor navigated away. Not an error, and not worth a log line.
    return plain("client_closed_request", 499)
  }
  if (!photo.ok) return unavailable()
  if (!photo.value) return notFound()

  const upstream = photo.value
  if (!upstream.ok || !upstream.body) {
    // An unread body pins the connection in the Workers runtime.
    await upstream.body?.cancel()
    console.error(`mafk-web: larm photo — storage ${upstream.status}`)
    return upstream.status === 404 ? notFound() : unavailable()
  }

  const contentType = (upstream.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase()
  if (!ALLOWED_TYPES.has(contentType)) {
    await upstream.body.cancel()
    console.error(`mafk-web: larm photo — unexpected content-type ${contentType}`)
    return notFound()
  }

  // A new Response is required: a fetch response's headers are immutable, and
  // the middleware sets the security headers on whatever this returns.
  const headers = new Headers({
    "content-type": contentType,
    "Cache-Control": PHOTO_CACHE_CONTROL,
  })
  for (const passthrough of ["content-length", "etag"]) {
    const value = upstream.headers.get(passthrough)
    if (value) headers.set(passthrough, value)
  }
  return new Response(upstream.body, { status: 200, headers })
}
