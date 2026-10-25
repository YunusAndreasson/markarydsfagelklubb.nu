import { createHash } from "node:crypto"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { sanitizeContent } from "../../src/lib/sanitize"
import { captionStoredPhotos, tidyLineBreaks } from "./tidy"
import { TITLE_FIXES } from "./title-fixes"

/**
 * The 2026-10-24 tidy of the articles already imported (docs/wp-import.md,
 * "Tidying"): photo captions back into figures, WordPress's line breaks
 * sorted out, and the reviewed titles. A one-off, like the import; the import
 * itself now does the same, so a re-run keeps the result.
 *
 *   supabase db query --linked -o json \
 *     "select id, wp_id, title, body_html from public.articles" > rows.json
 *   pnpm exec tsx scripts/wp-import/tidy-stored.ts --rows rows.json --out <dir>
 *   supabase db query --linked -f <dir>/tidy-01.sql   (each file in turn)
 *
 * It needs no key and writes nothing itself: it reads the exported rows and
 * the import's cache of WordPress posts (for the captions), and writes SQL and
 * a report to review first. Each update is guarded by the row's checksum, so
 * an article edited in /admin after the export is left alone.
 */

const { values } = parseArgs({
  options: {
    rows: { type: "string" },
    out: { type: "string" },
    cache: { type: "string", default: ".wp-import/cache" },
  },
})
if (!values.rows || !values.out) {
  console.error("tidy-stored: --rows <exported json> and --out <dir> are required")
  process.exit(1)
}

type Row = { id: number; wp_id: number | null; title: string; body_html: string }
type CachedPost = { id: number; content: { rendered: string } }

const md5 = (text: string) => createHash("md5").update(text, "utf8").digest("hex")
const BATCH = 40
const QUOTE = "$tidy$"

const rows: Row[] = JSON.parse(await readFile(values.rows, "utf8")).rows

const captionsByPost = new Map<number, string[]>()
for (const name of await readdir(values.cache)) {
  if (!name.startsWith("_wp_json_wp_v2_posts_per_page_100_")) continue
  const posts: CachedPost[] = JSON.parse(await readFile(join(values.cache, name), "utf8"))
  for (const post of posts) {
    const captions = [
      ...post.content.rendered.matchAll(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi),
    ]
    captionsByPost.set(
      post.id,
      captions.map((match) => match[1] ?? "")
    )
  }
}

const updates: string[] = []
const report: string[] = []
let titles = 0
let bodies = 0
let figures = 0
let missingCaptions = 0

for (const row of rows) {
  const captions = row.wp_id === null ? [] : (captionsByPost.get(row.wp_id) ?? [])
  const captioned = captionStoredPhotos(row.body_html, captions)
  const body = sanitizeContent(tidyLineBreaks(captioned.html))
  const title = (row.wp_id !== null && TITLE_FIXES[row.wp_id]) || row.title
  if (body.includes(QUOTE) || title.includes(QUOTE)) throw new Error(`${row.id} holds ${QUOTE}`)

  const nonEmptyCaptions = captions.filter(
    (caption) => caption.replace(/<[^>]*>|&nbsp;|\s/g, "") !== ""
  )
  missingCaptions += nonEmptyCaptions.length - captioned.captioned
  figures += captioned.captioned
  if (body === row.body_html && title === row.title) continue
  if (body !== row.body_html) bodies++
  if (title !== row.title) titles++

  const set = [
    title !== row.title ? `title = ${QUOTE}${title}${QUOTE}` : null,
    body !== row.body_html ? `body_html = ${QUOTE}${body}${QUOTE}` : null,
  ].filter(Boolean)
  updates.push(
    `update public.articles set ${set.join(", ")} where id = ${row.id} and md5(title) = '${md5(row.title)}' and md5(body_html) = '${md5(row.body_html)}';`
  )
  report.push(
    `## ${row.id} (wp ${row.wp_id})${title !== row.title ? `\n- title: ${row.title} → ${title}` : ""}` +
      (body !== row.body_html
        ? `\n- captions: ${captioned.captioned} of ${nonEmptyCaptions.length}` +
          `\n- before:\n${row.body_html}\n- after:\n${body}`
        : "")
  )
}

await mkdir(values.out, { recursive: true })
for (let start = 0; start < updates.length; start += BATCH) {
  const name = `tidy-${String(start / BATCH + 1).padStart(2, "0")}.sql`
  await writeFile(
    join(values.out, name),
    `begin;\n${updates.slice(start, start + BATCH).join("\n")}\ncommit;\n`
  )
}
const expected = rows.map((row) => {
  const captions = row.wp_id === null ? [] : (captionsByPost.get(row.wp_id) ?? [])
  const body = sanitizeContent(tidyLineBreaks(captionStoredPhotos(row.body_html, captions).html))
  const title = (row.wp_id !== null && TITLE_FIXES[row.wp_id]) || row.title
  return { id: row.id, title_md5: md5(title), body_md5: md5(body) }
})
await writeFile(join(values.out, "expected.json"), JSON.stringify(expected))
await writeFile(join(values.out, "report.md"), `${report.join("\n\n")}\n`)

console.log(
  `${rows.length} articles: ${updates.length} to update (${titles} titles, ${bodies} bodies), ` +
    `${figures} captions back in figures, ${missingCaptions} WordPress captions not found, ` +
    `${Math.ceil(updates.length / BATCH)} SQL files in ${values.out}`
)
