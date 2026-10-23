import { join } from "node:path"
import { parseArgs } from "node:util"
import { sanitizeContent } from "../../src/lib/sanitize"
import { flattenTree, NOT_IMPORTED } from "./page-tree"
import { readExport, WordPressClient } from "./sources"
import { siteImageTag, transformBody, unlinkFile } from "./transform"
import { copyFile, importImage, openBackend, publishPages, upsertPage } from "./write"

/**
 * The page tree (docs/wp-import.md, "Still open"), from the signed-off menu in
 * page-tree.ts and WordPress's page bodies.
 *
 *   pnpm wp-import:pages --export <wxr> --dry-run
 *   pnpm wp-import:pages --export <wxr> --env .env --key-var sb
 *   pnpm wp-import:pages --export <wxr> --env .env --key-var sb --publish
 *
 * Without --publish, new entries are written as drafts: the dummy menu stays
 * live and the real one can be reviewed in /admin/sidor. --publish switches:
 * it publishes the imported tree and deletes the dummy pages.
 */

const { values } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    export: { type: "string" },
    env: { type: "string" },
    "key-var": { type: "string" },
    publish: { type: "boolean", default: false },
    files: { type: "boolean", default: false },
  },
})

type WpPage = {
  id: number
  date_gmt: string
  title: { rendered: string }
  content: { rendered: string }
}

function fail(message: string): never {
  console.error(`wp-import:pages: ${message}`)
  process.exit(1)
}

const dryRun = values["dry-run"] === true
if (!values.export) fail("--export <path to the WXR file> is required")
if (!dryRun && !values.env) fail("a real run needs --env <file> (or add --dry-run)")

const db = dryRun ? null : openBackend(values.env ?? "", values["key-var"])
const wp = new WordPressClient(join(".wp-import", "cache"))
const wxr = await readExport(values.export)
const wpPages = await wp.get<WpPage[]>(
  "/wp-json/wp/v2/pages?per_page=100&status=publish&_fields=id,parent,slug,link,title,content,menu_order,date_gmt,modified_gmt"
)
const byId = new Map(wpPages.map((page) => [page.id, page]))

const idsByPath = new Map<string, number>()
console.log(dryRun ? "\nDry run: the page tree. Nothing is written.\n" : "\nThe page tree:\n")

for (const { entry, path, parentPath, sortOrder } of flattenTree()) {
  const depth = path.split("/").length - 2
  const parentId = parentPath ? (idsByPath.get(parentPath) ?? null) : null
  if (parentPath && parentId === null && db)
    fail(`${path}: its parent ${parentPath} wasn't written`)

  let body = ""
  let wpId: number | null = null
  const problems: string[] = []
  if (entry.kind === "page" && entry.wpId !== null) {
    const source = byId.get(entry.wpId)
    if (!source) fail(`${path}: WordPress page ${entry.wpId} isn't in the REST response`)
    wpId = entry.wpId
    const transformed = transformBody(source.content.rendered, {
      attachmentsById: wxr.attachmentsById,
      attachmentsByUrl: wxr.attachmentsByUrl,
      postDate: new Date(`${source.date_gmt}Z`),
      rewriteFiles: values.files === true,
    })
    let html = transformed.html
    for (const need of transformed.images) {
      if (!db) continue
      const planned = siteImageTag(need.image)
      const result = await importImage(db, need.source, need.image.storage_prefix, need.image.alt)
      if (result.kind === "unreachable") {
        problems.push(`image dropped, the original doesn't answer: ${need.source}`)
        html = html.replace(planned, "")
      } else {
        html = html.replace(planned, siteImageTag(result.image))
      }
    }
    body = sanitizeContent(html)
    for (const file of transformed.files) {
      if (values.files && file.path) {
        if (db && (await copyFile(db, file.source, file.path)) === "unreachable") {
          problems.push(`linked ${file.kind} doesn't answer, link removed: ${file.source}`)
          body = unlinkFile(body, file.path)
        }
      } else {
        problems.push(
          `linked ${file.kind} not copied${values.files ? "" : " (run with --files)"}: ${file.source}`
        )
      }
    }
  }

  let outcome = ""
  if (db) {
    const result = await upsertPage(db, {
      parent_id: parentId,
      kind: entry.kind,
      slug: entry.slug,
      title: entry.title,
      link_url: entry.kind === "link" ? entry.url : null,
      body_html: body,
      show_in_menu: entry.showInMenu,
      sort_order: sortOrder,
      wp_id: wpId,
    })
    idsByPath.set(path, result.id)
    outcome = `  [${result.outcome}]`
  } else {
    idsByPath.set(path, -1)
  }

  const what =
    entry.kind === "link" ? `→ ${entry.url}` : `${path}${body ? ` (${body.length} b)` : ""}`
  const hidden = entry.showInMenu ? "" : "  (not in the menu)"
  console.log(`${"    ".repeat(depth)}${entry.title}  ${what}${hidden}${outcome}`)
  for (const problem of problems) console.log(`${"    ".repeat(depth)}  ! ${problem}`)
}

console.log("\nNot imported:")
for (const [id, why] of Object.entries(NOT_IMPORTED)) console.log(`  #${id}  ${why}`)

if (values.publish) {
  if (!db) fail("--publish needs a real run")
  const result = await publishPages(db, [...idsByPath.values()])
  console.log(
    `\nPublished the ${result.published} entries and removed ${result.removed} dummy pages.`
  )
} else if (db) {
  console.log("\nNew entries are drafts. Review them in /admin/sidor, then rerun with --publish.")
}
