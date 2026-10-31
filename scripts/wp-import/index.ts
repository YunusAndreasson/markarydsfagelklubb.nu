import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { sanitizeContent } from "../../src/lib/sanitize"
import { pickCategory, SITE_CATEGORIES } from "./categories"
import { fetchPosts, readExport, WordPressClient, type WpCategory } from "./sources"
import { tidyLineBreaks } from "./tidy"
import { TITLE_FIXES } from "./title-fixes"
import {
  cleanExcerpt,
  cleanTitle,
  fallbackTitle,
  isWpUrl,
  oldPath,
  plannedPrefix,
  siteImageTag,
  siteSlug,
  transformBody,
  unlinkFile,
} from "./transform"
import {
  checkSchema,
  copyFile,
  ensureCategories,
  importImage,
  openBackend,
  upsertArticle,
} from "./write"

/**
 * The WordPress import (step 8). Build spec: docs/wp-import.md.
 *
 *   pnpm wp-import --export <wxr> --limit 10 --dry-run
 *   pnpm wp-import --export <wxr> --limit 10 --env <file with SUPABASE_SECRET_KEY>
 *
 * Both read WordPress (through a cache, one request at a time) and the WXR
 * export, and transform and sanitize every body the same way. The dry run
 * writes the result under `.wp-import/dry-run/` for review and touches nothing
 * else; it needs no key. The real run also uploads the images, inserts the
 * categories and upserts the articles on their WordPress id, so it can be run
 * again after a fix. `--limit` takes the newest N; without it, every post.
 */

const { values } = parseArgs({
  options: {
    limit: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    export: { type: "string" },
    env: { type: "string" },
    // The variable in --env that holds the key, if not SUPABASE_SECRET_KEY.
    "key-var": { type: "string" },
    // Copy linked documents to site-files and point the links there.
    files: { type: "boolean", default: false },
  },
})

/**
 * Posts with no image of their own that the club chose to show under another post's
 * photo, as WordPress post id to `media.id`. Here so a re-run before the cutover
 * doesn't clear the choice. 10340, today's rally report, uses Programändring's.
 */
const SHARED_COVERS: Readonly<Record<number, number>> = { 10340: 10 }

const WORK_DIR = ".wp-import"
const dryRun = values["dry-run"] === true
const OUT_DIR = join(WORK_DIR, dryRun ? "dry-run" : "run")

function fail(message: string): never {
  console.error(`wp-import: ${message}`)
  process.exit(1)
}

const limit = values.limit === undefined ? null : Number(values.limit)
if (limit !== null && !(Number.isInteger(limit) && limit > 0)) {
  fail("--limit takes a whole number (the pilot is --limit 10)")
}
if (!dryRun && !values.env) {
  fail("a real run needs --env <file> holding SUPABASE_SECRET_KEY (or add --dry-run)")
}
if (!values.export) {
  fail(
    "--export <path to the WXR file> is required (e.g. ~/Downloads/markarydsfgelklubb.WordPress.2026-10-23.xml)"
  )
}

const db = dryRun ? null : openBackend(values.env ?? "", values["key-var"])
if (db) await checkSchema(db)
const categoryIds = db ? await ensureCategories(db) : null

const wp = new WordPressClient(join(WORK_DIR, "cache"))
const wxr = await readExport(values.export)

const categories = await wp.get<WpCategory[]>(
  "/wp-json/wp/v2/categories?per_page=100&_fields=id,name,slug"
)
const wpCategorySlug = new Map(categories.map((category) => [category.id, category.slug]))

const posts = await fetchPosts(wp, limit)

await rm(OUT_DIR, { recursive: true, force: true })
await mkdir(join(OUT_DIR, "bodies"), { recursive: true })

type Planned = {
  wpId: number
  slug: string
  title: string
  excerpt: string
  category: string | null
  author: string
  publishedAt: string
  redirect: { from: string; to: string }
  cover: string | null
  images: {
    source: string
    storagePrefix: string
    widths: number[]
    hotlinked: boolean
    guessed: boolean
  }[]
  files: { source: string; kind: string }[]
  internalLinks: string[]
  captions: number
  problems: string[]
  /** What the real run did; null in a dry run, or when the post was skipped. */
  outcome: string | null
}

const planned: Planned[] = []
const slugsSeen = new Set<string>()

for (const post of posts) {
  const problems: string[] = []
  if (post.status !== "publish") continue
  if (post.content.protected)
    problems.push("password-protected: the body is not readable anonymously")

  const wpTitle = cleanTitle(post.title.rendered)
  // The reviewed spelling wins over what WordPress has (title-fixes.ts).
  const title = TITLE_FIXES[post.id] ?? (wpTitle || fallbackTitle(post.content.rendered))
  if (!title) problems.push("no title, and no bold line in the body to take one from")

  const slug = siteSlug(post.slug)
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    problems.push(`slug "${post.slug}" gives no valid site slug`)
  if (slugsSeen.has(slug)) problems.push(`slug "${slug}" collides with another post`)
  slugsSeen.add(slug)

  const category = pickCategory(post.categories.map((id) => wpCategorySlug.get(id) ?? `#${id}`))
  if (category.kind === "unmapped")
    problems.push(`unmapped categories: ${category.wpSlugs.join(", ")}`)

  const publishedAt = new Date(`${post.date_gmt}Z`)
  const body = transformBody(post.content.rendered, {
    attachmentsById: wxr.attachmentsById,
    attachmentsByUrl: wxr.attachmentsByUrl,
    postDate: publishedAt,
    rewriteFiles: values.files === true,
  })
  // Blocking problems skip the post in a real run; the rest are notes.
  const blocked = problems.length > 0
  if (!wpTitle && title)
    problems.push(`untitled on WordPress; titled from its first bold line: "${title}"`)

  // The real run swaps each planned tag for the stored image's, which has
  // the measured size, or removes it when the file can't be fetched.
  let bodyHtml = body.html
  if (db && !blocked) {
    for (const need of body.images) {
      const planned = siteImageTag(need.image)
      const result = await importImage(db, need.source, need.image.storage_prefix, need.image.alt)
      if (result.kind === "unreachable") {
        problems.push(`image dropped, the original doesn't answer: ${need.source}`)
        bodyHtml = bodyHtml.replace(planned, "")
      } else {
        bodyHtml = bodyHtml.replace(planned, siteImageTag(result.image))
      }
    }
  }
  // Line breaks from WordPress's classic editor sorted out (tidy.ts).
  let html = sanitizeContent(tidyLineBreaks(bodyHtml))

  // The two checks the spec asks a human to make, made here first.
  const keptImages = (html.match(/<img\s/g) ?? []).length
  const expectedImages =
    body.images.length - problems.filter((problem) => problem.startsWith("image dropped")).length
  if (keptImages !== expectedImages) {
    problems.push(`${body.images.length} images planned, ${keptImages} survived the sanitizer`)
  }
  const leftovers = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1] ?? "")
    .filter((url) => isWpUrl(url) && !new URL(url).pathname.startsWith("/wp-content/uploads/"))
  if (leftovers.length > 0)
    problems.push(`WordPress URLs left in the body: ${leftovers.join(", ")}`)

  // A featured image becomes the cover only when the body doesn't already
  // show it (8 of the 14 posts that have one), or the photo would be printed
  // twice. Without a cover, the article is purely typographic.
  const featured = post.featured_media
    ? wxr.attachmentsById.get(String(post.featured_media))
    : undefined
  if (post.featured_media && !featured) {
    problems.push(`featured image #${post.featured_media} is not in the export; no cover`)
  }
  const cover =
    featured && !body.images.some((image) => image.source === featured.url)
      ? {
          source: featured.url,
          prefix: plannedPrefix(featured.url, publishedAt),
        }
      : null
  let coverMediaId: number | null = null
  if (db && !blocked && cover) {
    const result = await importImage(db, cover.source, cover.prefix, "")
    if (result.kind === "unreachable")
      problems.push(`cover dropped, the original doesn't answer: ${cover.source}`)
    else coverMediaId = result.id
  }
  for (const image of body.images.filter((image) => image.guessed)) {
    problems.push(`image not in the export, original guessed: ${image.source}`)
  }
  for (const file of body.files) {
    if (values.files && file.path) {
      if (db && !blocked) {
        const copied = await copyFile(db, file.source, file.path)
        if (copied === "unreachable") {
          problems.push(`linked ${file.kind} doesn't answer, link removed: ${file.source}`)
          html = unlinkFile(html, file.path)
        }
      }
    } else {
      problems.push(
        `linked ${file.kind} not copied${values.files ? "" : " (run with --files)"}: ${file.source}`
      )
    }
  }

  const excerpt = cleanExcerpt(wxr.excerpts.get(post.id))
  const author = post._embedded?.author?.[0]?.name ?? ""
  let outcome: string | null = null
  if (db && categoryIds) {
    if (blocked) {
      outcome = "skipped"
    } else {
      // One post the database refuses is reported, not fatal: the run is
      // idempotent, so it is fixed and run again.
      try {
        outcome = await upsertArticle(db, {
          wp_id: post.id,
          slug,
          title,
          excerpt,
          body_html: html,
          category_id:
            category.kind === "category" ? (categoryIds.get(category.slug) ?? null) : null,
          cover_media_id: coverMediaId ?? SHARED_COVERS[post.id] ?? null,
          author_name: author,
          published_at: publishedAt.toISOString(),
        })
      } catch (caught) {
        outcome = "failed"
        problems.push(caught instanceof Error ? caught.message : String(caught))
      }
    }
  }

  await writeFile(join(OUT_DIR, "bodies", `${slug}.html`), `${html}\n`)
  planned.push({
    wpId: post.id,
    slug,
    title,
    excerpt,
    category: category.kind === "category" ? category.slug : null,
    author,
    publishedAt: publishedAt.toISOString(),
    redirect: { from: oldPath(post.link), to: `/artiklar/${slug}` },
    cover: cover?.source ?? null,
    images: body.images.map((image) => ({
      source: image.source,
      storagePrefix: image.image.storage_prefix,
      widths: image.image.widths,
      hotlinked: image.hotlinked,
      guessed: image.guessed,
    })),
    files: body.files,
    internalLinks: body.internalLinks,
    captions: body.captions,
    problems,
    outcome,
  })
}

await writeFile(join(OUT_DIR, "plan.json"), `${JSON.stringify(planned, null, 2)}\n`)
// The old-URL map for the Worker (roadmap D6), which serves it at the cutover.
await writeFile(
  join(OUT_DIR, "redirects.json"),
  `${JSON.stringify(Object.fromEntries(planned.map((post) => [post.redirect.from, post.redirect.to])), null, 2)}\n`
)

// The report.
const categoryName = new Map(SITE_CATEGORIES.map((category) => [category.slug, category.name]))
const date = new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeZone: "Europe/Stockholm" })
console.log(
  dryRun
    ? `\nDry run: ${planned.length} posts, newest first. Nothing was written.\n`
    : `\nImported: ${planned.length} posts, newest first.\n`
)
for (const post of planned) {
  console.log(
    `${date.format(new Date(post.publishedAt))}  ${post.title}${post.outcome ? `  [${post.outcome}]` : ""}`
  )
  console.log(`    /artiklar/${post.slug}  ←  ${post.redirect.from}`)
  console.log(
    `    ${post.category ? categoryName.get(post.category) : "ingen kategori"} · ${post.author || "ingen författare"}` +
      ` · ${post.images.length} bilder · ${post.captions} bildtexter · ${post.files.length} filer` +
      (post.excerpt ? " · egen ingress" : "") +
      (post.cover ? " · omslagsbild" : "")
  )
  for (const problem of post.problems) console.log(`    ! ${problem}`)
}
const images = planned.flatMap((post) => post.images)
const files = planned.flatMap((post) => post.files)
console.log(
  `\n${dryRun ? "Would upload" : "Handled"} ${images.length} images (${images.filter((image) => image.hotlinked).length} hotlinked)` +
    ` and ${files.length} links to documents (${values.files ? (dryRun ? "would copy" : "copied") : "not copied, see --files"}); ${dryRun ? "would insert" : "inserted"} any of the ${SITE_CATEGORIES.length} categories that were missing.`
)
console.log(`Bodies: ${join(OUT_DIR, "bodies")}/   Plan: ${join(OUT_DIR, "plan.json")}`)
console.log(
  `${planned.filter((post) => post.problems.length > 0).length} posts have something to look at (marked !).`
)
