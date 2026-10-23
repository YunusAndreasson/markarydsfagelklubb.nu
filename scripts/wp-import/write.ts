import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import sharp from "sharp"
import type { Database } from "../../src/lib/database.types"
import { createFetchWithTimeout } from "../../src/lib/fetch"
import {
  type MediaImage,
  mediaObjectPath,
  planImageWidths,
  SITE_MEDIA_BUCKET,
  SUPABASE_ORIGIN,
} from "../../src/lib/media"
import { SITE_CATEGORIES } from "./categories"
import { isWpUrl, SITE_FILES_BUCKET } from "./transform"

/**
 * The writing half of the import: the database and the site-media bucket,
 * with the secret key. It runs on a developer's machine only, never in CI and
 * never in the Worker, and it writes only this repo's own tables and bucket
 * (docs/shared-database.md). The key stays inside this module.
 */

type Db = SupabaseClient<Database>

const fetchWithTimeout = createFetchWithTimeout(60_000)

/** The same pause as the REST reads: the WordPress host blocks bursts. */
const WP_PAUSE_MS = 2_000
const USER_AGENT = "mafk-web-import (Markaryds Fagelklubb; one request at a time)"

/** Quality 0.82, as the admin's browser uploader encodes (image-variants.ts). */
const WEBP_QUALITY = 82

export function openBackend(envFile: string, keyVar = "SUPABASE_SECRET_KEY"): Db {
  process.loadEnvFile(envFile)
  const key = process.env[keyVar] ?? ""
  // A key copied from `supabase projects api-keys` is masked and ends in "·".
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error(`${keyVar} in ${envFile} is missing or isn't a full sb_secret_ key`)
  }
  return createClient<Database>(SUPABASE_ORIGIN, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: createFetchWithTimeout(60_000) },
  })
}

/** Refuse to start before the wp_id migration is applied. */
export async function checkSchema(db: Db): Promise<void> {
  const { error } = await db.from("articles").select("wp_id").limit(1)
  if (error) {
    throw new Error(
      `articles.wp_id is not readable (${error.message}). Apply supabase/migrations/*_wp_import_ids.sql with supabase db push first.`
    )
  }
}

/** The six categories, inserted if absent. Returns slug → id. */
export async function ensureCategories(db: Db): Promise<Map<string, number>> {
  const rows = SITE_CATEGORIES.map((category, index) => ({ ...category, sort_order: index }))
  const { error } = await db
    .from("categories")
    .upsert(rows, { onConflict: "slug", ignoreDuplicates: true })
  if (error) throw new Error(`categories: ${error.message}`)
  const { data, error: readError } = await db
    .from("categories")
    .select("id, slug")
    .in(
      "slug",
      SITE_CATEGORIES.map((category) => category.slug)
    )
  if (readError) throw new Error(`categories: ${readError.message}`)
  return new Map(data.map((row) => [row.slug, row.id]))
}

/**
 * Every original the import downloads, kept byte for byte under
 * `.wp-import/originals/<host>/<path>`, because re-encoding is one-way and
 * WordPress is being switched off. Not a substitute for the full
 * `wp-content/uploads` archive, which also holds what no post uses.
 */
const ORIGINALS_DIR = join(".wp-import", "originals")

async function keepOriginal(url: string, bytes: Buffer): Promise<void> {
  const { hostname, pathname } = new URL(url)
  const file = join(ORIGINALS_DIR, hostname, decodeURIComponent(pathname).replace(/\.\.+/g, "."))
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, bytes)
}

async function download(url: string): Promise<Buffer | null> {
  if (isWpUrl(url)) await sleep(WP_PAUSE_MS)
  try {
    const response = await fetchWithTimeout(url, { headers: { "User-Agent": USER_AGENT } })
    if (!response.ok) return null
    // Not "must be image/": WordPress serves some uploads named plain `jpg`
    // with no content type at all. An error page is HTML; sharp judges the rest.
    const type = response.headers.get("content-type") ?? ""
    if (type.startsWith("text/")) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    await keepOriginal(url, bytes)
    return bytes
  } catch {
    return null
  }
}

export type ImageOutcome =
  | { kind: "existing"; id: number; image: MediaImage }
  | { kind: "uploaded"; id: number; image: MediaImage; bytes: number }
  | { kind: "unreachable" }

/**
 * One image into site-media at its planned prefix, and its `media` row. The
 * prefix is derived from the source URL, so a second run finds the row and
 * skips the download.
 */
export async function importImage(
  db: Db,
  source: string,
  prefix: string,
  alt: string
): Promise<ImageOutcome> {
  const { data: existing, error: lookupError } = await db
    .from("media")
    .select("id, storage_prefix, format, widths, width, height, alt")
    .eq("storage_prefix", prefix)
    .maybeSingle()
  if (lookupError) throw new Error(`media lookup: ${lookupError.message}`)
  if (existing) {
    const { id, ...image } = existing
    return { kind: "existing", id, image: { ...image, format: "webp", alt } }
  }

  const original = await download(source)
  if (!original) return { kind: "unreachable" }

  // Camera orientation applied once, so every variant is upright.
  let upright: { data: Buffer; info: { width: number; height: number } }
  try {
    upright = await sharp(original).rotate().toBuffer({ resolveWithObject: true })
  } catch {
    return { kind: "unreachable" }
  }
  const { width, height } = upright.info
  const widths = planImageWidths(width)
  let bytes = 0
  const paths: string[] = []
  try {
    for (const target of widths) {
      const variant = await sharp(upright.data)
        .resize({ width: target })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer()
      bytes += variant.byteLength
      const path = mediaObjectPath(prefix, target, "webp")
      const { error } = await db.storage.from(SITE_MEDIA_BUCKET).upload(path, variant, {
        contentType: "image/webp",
        cacheControl: "31536000",
        // A rerun after a failed insert overwrites its own half-done upload.
        upsert: true,
      })
      if (error) throw new Error(`upload ${path}: ${error.message}`)
      paths.push(path)
    }
    const image: MediaImage = { storage_prefix: prefix, format: "webp", widths, width, height, alt }
    const { data, error } = await db
      .from("media")
      .insert({ ...image, bytes })
      .select("id")
      .single()
    if (error) throw new Error(`media insert: ${error.message}`)
    return { kind: "uploaded", id: data.id, image, bytes }
  } catch (caught) {
    // Leave nothing half-uploaded behind, as the admin's uploader does.
    if (paths.length > 0) await db.storage.from(SITE_MEDIA_BUCKET).remove(paths)
    throw caught
  }
}

export type ArticleRow = {
  wp_id: number
  slug: string
  title: string
  excerpt: string
  body_html: string
  category_id: number | null
  cover_media_id: number | null
  author_name: string
  published_at: string
}

/** Insert or update on the WordPress id. Always published, as on WordPress. */
export async function upsertArticle(db: Db, row: ArticleRow): Promise<"inserted" | "updated"> {
  const { data: before, error: lookupError } = await db
    .from("articles")
    .select("id")
    .eq("wp_id", row.wp_id)
    .maybeSingle()
  if (lookupError) throw new Error(`article lookup: ${lookupError.message}`)
  const { error } = await db
    .from("articles")
    .upsert({ ...row, status: "published" }, { onConflict: "wp_id" })
  if (error) throw new Error(`article ${row.slug}: ${error.message}`)
  return before ? "updated" : "inserted"
}

export type PageRow = {
  parent_id: number | null
  kind: "page" | "link"
  slug: string
  title: string
  link_url: string | null
  body_html: string
  show_in_menu: boolean
  sort_order: number
  wp_id: number | null
}

/**
 * Insert or update one entry of the page tree, found by its place (parent and
 * slug, which the table keeps unique). New entries are drafts: nobody sees the
 * real tree until `publishPages` switches it in. An existing entry keeps its
 * status, so a re-run never unpublishes or publishes anything.
 */
export async function upsertPage(
  db: Db,
  row: PageRow
): Promise<{ id: number; outcome: "inserted" | "updated" }> {
  const lookup = db.from("pages").select("id").eq("slug", row.slug)
  const { data: existing, error: lookupError } = await (row.parent_id === null
    ? lookup.is("parent_id", null)
    : lookup.eq("parent_id", row.parent_id)
  ).maybeSingle()
  if (lookupError) throw new Error(`page lookup ${row.slug}: ${lookupError.message}`)
  if (existing) {
    const { error } = await db.from("pages").update(row).eq("id", existing.id)
    if (error) throw new Error(`page ${row.slug}: ${error.message}`)
    return { id: existing.id, outcome: "updated" }
  }
  const { data, error } = await db
    .from("pages")
    .insert({ ...row, status: "draft", published_at: null })
    .select("id")
    .single()
  if (error) throw new Error(`page ${row.slug}: ${error.message}`)
  return { id: data.id, outcome: "inserted" }
}

/**
 * The switch to the real menu: publish every entry of the imported tree, then
 * remove the dummy pages (`exempel-` slugs), children before parents. Only run
 * when the user has reviewed the drafts in /admin.
 */
export async function publishPages(
  db: Db,
  ids: number[]
): Promise<{ published: number; removed: number }> {
  const { error } = await db
    .from("pages")
    .update({ status: "published", published_at: new Date().toISOString() })
    .in("id", ids)
    .eq("status", "draft")
  if (error) throw new Error(`publish: ${error.message}`)
  const { data: children, error: childError } = await db
    .from("pages")
    .delete()
    .like("slug", "exempel-%")
    .not("parent_id", "is", null)
    .select("id")
  if (childError) throw new Error(`remove dummy subpages: ${childError.message}`)
  const { data: roots, error: rootError } = await db
    .from("pages")
    .delete()
    .like("slug", "exempel-%")
    .select("id")
  if (rootError) throw new Error(`remove dummy pages: ${rootError.message}`)
  return { published: ids.length, removed: (children?.length ?? 0) + (roots?.length ?? 0) }
}

const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

/**
 * One linked document into site-files at `path`, byte for byte. A file already
 * there is left alone, so a re-run downloads nothing it has. Needs the
 * site-files migration applied.
 */
export async function copyFile(
  db: Db,
  source: string,
  path: string
): Promise<"existing" | "copied" | "unreachable"> {
  const { data: existing, error: listError } = await db.storage
    .from(SITE_FILES_BUCKET)
    .list(path.split("/").slice(0, -1).join("/"), { search: path.split("/").pop() ?? "" })
  if (listError) throw new Error(`site-files: ${listError.message} (is *_site_files.sql applied?)`)
  if (existing?.some((object) => object.name === path.split("/").pop())) return "existing"

  if (isWpUrl(source)) await sleep(WP_PAUSE_MS)
  let bytes: Buffer
  try {
    const response = await fetchWithTimeout(source, { headers: { "User-Agent": USER_AGENT } })
    if (!response.ok || (response.headers.get("content-type") ?? "").startsWith("text/html"))
      return "unreachable"
    bytes = Buffer.from(await response.arrayBuffer())
  } catch {
    return "unreachable"
  }
  await keepOriginal(source, bytes)
  const extension = path.split(".").pop()?.toLowerCase() ?? ""
  const { error } = await db.storage.from(SITE_FILES_BUCKET).upload(path, bytes, {
    contentType: FILE_TYPES[extension] ?? "application/octet-stream",
    cacheControl: "31536000",
    upsert: true,
  })
  if (error) throw new Error(`upload ${path}: ${error.message}`)
  return "copied"
}
