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
import { isWpUrl } from "./transform"

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
    const type = response.headers.get("content-type") ?? ""
    if (!type.startsWith("image/")) return null
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
  const upright = await sharp(original).rotate().toBuffer({ resolveWithObject: true })
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
