import type { PostgrestError } from "@supabase/supabase-js"
import type { Database } from "./database.types"
import { type MediaFormat, mediaObjectPath, SITE_MEDIA_BUCKET } from "./media"
import type { MembershipInput } from "./membership"
import type { PageRow, PageTree } from "./page-tree"
import type { SupabaseServerClient } from "./supabase-server"

/**
 * The admin's reads and writes, with the admin's own session. RLS decides what
 * actually happens (`private.is_admin()`); this module only shapes the calls
 * and turns database errors into something a form can show.
 */

type Tables = Database["public"]["Tables"]
export type ArticleRow = Tables["articles"]["Row"]
export type EventRow = Tables["events"]["Row"]
export type PageRecord = Tables["pages"]["Row"]
export type CategoryRow = Tables["categories"]["Row"]
export type MediaRow = Tables["media"]["Row"]

export type WriteResult<T = null> =
  | { ok: true; value: T }
  | { ok: false; reason: "duplicate" | "in_use" | "failed" }

const UNIQUE_VIOLATION = "23505"
const FOREIGN_KEY_VIOLATION = "23503"

function failure(context: string, error: PostgrestError): WriteResult<never> {
  if (error.code === UNIQUE_VIOLATION) return { ok: false, reason: "duplicate" }
  if (error.code === FOREIGN_KEY_VIOLATION) return { ok: false, reason: "in_use" }
  console.error(`mafk-web: ${context} failed — ${error.code} ${error.message}`)
  return { ok: false, reason: "failed" }
}

/** What a failed write means, in the admin's words. */
export const WRITE_MESSAGES = {
  failed: "Det gick inte att spara. Försök igen om en stund.",
  in_use: "Det går inte, eftersom något annat fortfarande hänger ihop med det.",
} as const

// Articles

/**
 * The admin lists, newest first. Supabase's cap per response; the site holds 354
 * articles and 406 images, and a row beyond the limit can't be opened from a list.
 */
export const ADMIN_LIST_LIMIT = 1000

export async function listArticles(supabase: SupabaseServerClient) {
  return supabase
    .from("articles")
    .select("id, slug, title, status, published_at, updated_at, categories(name)")
    .order("published_at", { ascending: false, nullsFirst: true })
    .order("id", { ascending: false })
    .limit(ADMIN_LIST_LIMIT)
}

export async function loadArticle(supabase: SupabaseServerClient, id: number) {
  return supabase
    .from("articles")
    .select("*, cover:media(id, storage_prefix, format, widths, width, height, alt)")
    .eq("id", id)
    .maybeSingle()
}

export async function saveArticle(
  supabase: SupabaseServerClient,
  id: number | null,
  values: Tables["articles"]["Update"] & Pick<Tables["articles"]["Insert"], "slug" | "title">
): Promise<WriteResult<number>> {
  const query =
    id === null
      ? supabase.from("articles").insert(values).select("id").single()
      : supabase.from("articles").update(values).eq("id", id).select("id").single()
  const { data, error } = await query
  if (error) return failure("save article", error)
  return { ok: true, value: data.id }
}

export async function deleteArticle(
  supabase: SupabaseServerClient,
  id: number
): Promise<WriteResult> {
  const { error } = await supabase.from("articles").delete().eq("id", id)
  return error ? failure("delete article", error) : { ok: true, value: null }
}

// Events

/**
 * The programme, latest date first, so what the admin is planning sits at the
 * top and last season sinks to the bottom. Drafts included, as everywhere in
 * the admin: RLS decides, not the query.
 */
export async function listEvents(supabase: SupabaseServerClient) {
  return supabase
    .from("events")
    .select("id, slug, title, kind, starts_at, all_day, place, status, published_at")
    .order("starts_at", { ascending: false })
    .limit(ADMIN_LIST_LIMIT)
}

export async function loadEvent(supabase: SupabaseServerClient, id: number) {
  return supabase.from("events").select("*").eq("id", id).maybeSingle()
}

export async function saveEvent(
  supabase: SupabaseServerClient,
  id: number | null,
  values: Tables["events"]["Update"] &
    Pick<Tables["events"]["Insert"], "slug" | "title" | "starts_at">
): Promise<WriteResult<number>> {
  const query =
    id === null
      ? supabase.from("events").insert(values).select("id").single()
      : supabase.from("events").update(values).eq("id", id).select("id").single()
  const { data, error } = await query
  if (error) return failure("save event", error)
  return { ok: true, value: data.id }
}

export async function deleteEvent(
  supabase: SupabaseServerClient,
  id: number
): Promise<WriteResult> {
  const { error } = await supabase.from("events").delete().eq("id", id)
  return error ? failure("delete event", error) : { ok: true, value: null }
}

// Categories

export async function listCategories(supabase: SupabaseServerClient) {
  return supabase
    .from("categories")
    .select("id, slug, name, sort_order")
    .order("sort_order")
    .order("name")
}

export async function saveCategory(
  supabase: SupabaseServerClient,
  id: number | null,
  values: { name: string; slug: string }
): Promise<WriteResult> {
  const { error } =
    id === null
      ? await supabase.from("categories").insert(values)
      : await supabase.from("categories").update(values).eq("id", id)
  return error ? failure("save category", error) : { ok: true, value: null }
}

export async function deleteCategory(
  supabase: SupabaseServerClient,
  id: number
): Promise<WriteResult> {
  // Its articles keep existing without a category (on delete set null).
  const { error } = await supabase.from("categories").delete().eq("id", id)
  return error ? failure("delete category", error) : { ok: true, value: null }
}

// Places on a lokal

/** The app's lokaler, only read: the site never writes that table. */
export async function listLokalNames(supabase: SupabaseServerClient) {
  return supabase.from("locations").select("id, name").order("name")
}

export async function listAllLokalPoints(supabase: SupabaseServerClient) {
  return supabase
    .from("lokal_points")
    .select(
      "id, location_id, linked_location_id, kind, name, note, latitude, longitude, sort_order"
    )
    .order("sort_order")
}

export async function saveLokalPoint(
  supabase: SupabaseServerClient,
  id: number | null,
  locationId: number,
  values: {
    name: string
    note: string
    kind: string
    latitude: number | null
    longitude: number | null
    sort_order: number
  }
): Promise<WriteResult> {
  const { error } =
    id === null
      ? await supabase.from("lokal_points").insert({ ...values, location_id: locationId })
      : await supabase.from("lokal_points").update(values).eq("id", id)
  return error ? failure("save lokal point", error) : { ok: true, value: null }
}

export async function deleteLokalPoint(
  supabase: SupabaseServerClient,
  id: number
): Promise<WriteResult> {
  const { error } = await supabase.from("lokal_points").delete().eq("id", id)
  return error ? failure("delete lokal point", error) : { ok: true, value: null }
}

// Pages

const PAGE_TREE_COLUMNS =
  "id, parent_id, kind, slug, title, link_url, show_in_menu, sort_order, status, published_at"

export type AdminPageRow = PageRow & { status: string; published_at: string | null }

/** Every page and link, drafts included: the admin sees the whole tree. */
export async function listPageRows(supabase: SupabaseServerClient) {
  return supabase
    .from("pages")
    .select(PAGE_TREE_COLUMNS)
    .order("sort_order")
    .overrideTypes<AdminPageRow[], { merge: false }>()
}

export async function loadPage(supabase: SupabaseServerClient, id: number) {
  return supabase.from("pages").select("*").eq("id", id).maybeSingle()
}

export async function savePage(
  supabase: SupabaseServerClient,
  id: number | null,
  values: Tables["pages"]["Update"] & Pick<Tables["pages"]["Insert"], "slug" | "title">
): Promise<WriteResult<number>> {
  const query =
    id === null
      ? supabase.from("pages").insert(values).select("id").single()
      : supabase.from("pages").update(values).eq("id", id).select("id").single()
  const { data, error } = await query
  if (error) return failure("save page", error)
  return { ok: true, value: data.id }
}

export async function deletePage(supabase: SupabaseServerClient, id: number): Promise<WriteResult> {
  // `on delete restrict` refuses while subpages exist: reported as in_use.
  const { error } = await supabase.from("pages").delete().eq("id", id)
  return error ? failure("delete page", error) : { ok: true, value: null }
}

/**
 * Swap a page with its neighbour among its siblings, then renumber the
 * siblings 10, 20, 30 … so the order stays unambiguous however it started.
 */
export async function movePage(
  supabase: SupabaseServerClient,
  tree: PageTree,
  id: number,
  direction: "up" | "down"
): Promise<WriteResult> {
  const node = tree.byId.get(id)
  if (!node) return { ok: false, reason: "failed" }
  const siblings = [
    ...(node.parent_id === null ? tree.roots : (tree.byId.get(node.parent_id)?.children ?? [])),
  ]
  const index = siblings.findIndex((sibling) => sibling.id === id)
  const target = direction === "up" ? index - 1 : index + 1
  if (index === -1 || target < 0 || target >= siblings.length) return { ok: true, value: null }

  const [moved] = siblings.splice(index, 1)
  if (moved) siblings.splice(target, 0, moved)

  for (const [position, sibling] of siblings.entries()) {
    const sortOrder = (position + 1) * 10
    if (sibling.sort_order === sortOrder) continue
    const { error } = await supabase
      .from("pages")
      .update({ sort_order: sortOrder })
      .eq("id", sibling.id)
    if (error) return failure("move page", error)
  }
  return { ok: true, value: null }
}

// Media

export async function listMedia(supabase: SupabaseServerClient) {
  return supabase
    .from("media")
    .select("id, storage_prefix, format, widths, width, height, alt, bytes, created_at")
    .order("created_at", { ascending: false })
    .limit(ADMIN_LIST_LIMIT)
}

/**
 * Remove an image's files, then its row. Files first: a row without files is
 * a broken image, but files without a row would be invisible and never cleaned.
 */
export async function deleteMedia(
  supabase: SupabaseServerClient,
  media: Pick<MediaRow, "id" | "storage_prefix" | "format" | "widths">
): Promise<WriteResult> {
  const paths = media.widths.map((width) =>
    mediaObjectPath(media.storage_prefix, width, media.format as MediaFormat)
  )
  const { error: storageError } = await supabase.storage.from(SITE_MEDIA_BUCKET).remove(paths)
  if (storageError) {
    console.error(`mafk-web: delete media files failed — ${storageError.message}`)
    return { ok: false, reason: "failed" }
  }
  const { error } = await supabase.from("media").delete().eq("id", media.id)
  return error ? failure("delete media", error) : { ok: true, value: null }
}

// Membership

/** The one row of fees and payment details (src/lib/membership.ts). */
export async function loadMembershipSettings(supabase: SupabaseServerClient) {
  return supabase.from("membership_settings").select("*").maybeSingle()
}

/**
 * Update the one row. RLS turns a write by anyone but the admin into "no rows
 * matched" rather than an error, so an empty result counts as a failure too.
 */
export async function saveMembershipSettings(
  supabase: SupabaseServerClient,
  input: MembershipInput
): Promise<WriteResult> {
  const { data, error } = await supabase
    .from("membership_settings")
    .update(input)
    .eq("id", true)
    .select("year")
    .maybeSingle()
  if (error) return failure("save membership settings", error)
  if (!data) {
    console.error("mafk-web: save membership settings matched no row")
    return { ok: false, reason: "failed" }
  }
  return { ok: true, value: null }
}
