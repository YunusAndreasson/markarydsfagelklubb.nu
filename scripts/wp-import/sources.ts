import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { XMLParser } from "fast-xml-parser"
import { createFetchWithTimeout } from "../../src/lib/fetch"
import type { Attachment } from "./transform"

/**
 * Where the import reads from: the WordPress REST API, politely and through a
 * cache, and the WXR export on disk (docs/wp-import.md, "Sources").
 */

export const WP_ORIGIN = "https://markarydsfagelklubb.nu"

/**
 * The host's firewall blocked this IP on 2026-09-19 for ~830 HEAD requests,
 * six at a time. One request at a time, with this pause before each one. Not
 * a tuning knob.
 */
const PAUSE_MS = 2_000
const USER_AGENT = "mafk-web-import (Markaryds Fagelklubb; one request at a time)"

const fetchWithTimeout = createFetchWithTimeout(60_000)

export class WordPressClient {
  constructor(private readonly cacheDir: string) {}

  /**
   * GET a REST path, from the cache when it has been fetched before. Re-running
   * the dry run costs WordPress nothing; delete the cache to see new posts.
   */
  async get<T>(path: string): Promise<T> {
    const file = join(this.cacheDir, `${path.replace(/[^a-z0-9]+/gi, "_")}.json`)
    if (existsSync(file)) return JSON.parse(await readFile(file, "utf8")) as T
    await sleep(PAUSE_MS)
    const response = await fetchWithTimeout(`${WP_ORIGIN}${path}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    })
    if (!response.ok) throw new Error(`WordPress ${response.status} for ${path}`)
    const body = (await response.json()) as T
    await mkdir(this.cacheDir, { recursive: true })
    await writeFile(file, JSON.stringify(body))
    return body
  }
}

/** The fields of `/wp/v2/posts` the import reads. */
export type WpPost = {
  id: number
  date_gmt: string
  slug: string
  status: string
  link: string
  title: { rendered: string }
  content: { rendered: string; protected: boolean }
  featured_media: number
  categories: number[]
  _embedded?: {
    author?: { name?: string }[]
  }
}

export type WpCategory = { id: number; slug: string; name: string }

/**
 * The newest `limit` published posts, or all of them. 100 per request is the
 * REST API's maximum; four requests cover all 354, and the cache keeps a rerun
 * from asking again.
 */
export async function fetchPosts(wp: WordPressClient, limit: number | null): Promise<WpPost[]> {
  const posts: WpPost[] = []
  for (let page = 1; limit === null || posts.length < limit; page++) {
    const perPage = Math.min(100, limit ?? 100)
    const batch = await wp.get<WpPost[]>(
      `/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&orderby=date&order=desc&status=publish&_embed=author`
    )
    posts.push(...batch)
    if (batch.length < perPage) break
  }
  if (limit !== null) posts.length = Math.min(posts.length, limit)
  return posts
}

export type Export = {
  attachmentsById: Map<string, Attachment>
  attachmentsByUrl: Map<string, Attachment>
  /** WordPress post id → hand-written excerpt, only where there is one. */
  excerpts: Map<number, string>
}

type WxrMeta = { "wp:meta_key"?: string; "wp:meta_value"?: string }
type WxrItem = {
  "wp:post_id"?: string
  "wp:post_type"?: string
  "wp:attachment_url"?: string
  "excerpt:encoded"?: string
  "wp:postmeta"?: WxrMeta[]
}

/** The full-size dimensions from `_wp_attachment_metadata` (PHP-serialised). */
function dimensions(meta: WxrMeta[] | undefined): { width: number | null; height: number | null } {
  const value =
    meta?.find((entry) => entry["wp:meta_key"] === "_wp_attachment_metadata")?.["wp:meta_value"] ??
    ""
  const match = /s:5:"width";i:(\d+);s:6:"height";i:(\d+);/.exec(value)
  return match
    ? { width: Number(match[1]), height: Number(match[2]) }
    : { width: null, height: null }
}

export async function readExport(path: string): Promise<Export> {
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    processEntities: true,
    isArray: (name) => name === "item" || name === "wp:postmeta",
  })
  const xml = parser.parse(await readFile(path, "utf8")) as {
    rss?: { channel?: { item?: WxrItem[] } }
  }
  const items = xml.rss?.channel?.item ?? []

  const attachmentsById = new Map<string, Attachment>()
  const attachmentsByUrl = new Map<string, Attachment>()
  const excerpts = new Map<number, string>()
  for (const item of items) {
    const id = String(item["wp:post_id"] ?? "")
    if (item["wp:post_type"] === "attachment" && item["wp:attachment_url"]) {
      const url = item["wp:attachment_url"].replace("://www.", "://")
      const attachment: Attachment = { id, url, ...dimensions(item["wp:postmeta"]) }
      attachmentsById.set(id, attachment)
      attachmentsByUrl.set(url, attachment)
    }
    if (item["wp:post_type"] === "post" && item["excerpt:encoded"]?.trim()) {
      excerpts.set(Number(id), item["excerpt:encoded"])
    }
  }
  if (attachmentsById.size === 0)
    throw new Error(`No attachments in ${path}: is it a WordPress export?`)
  return { attachmentsById, attachmentsByUrl, excerpts }
}
