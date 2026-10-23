import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { buildRedirects } from "./redirects"
import { fetchPosts, WordPressClient } from "./sources"
import { cleanTitle, fallbackTitle } from "./transform"

/**
 * Writes src/data/wp-redirects.json, the map the Worker serves (D6).
 *
 *   pnpm wp-import:redirects
 *
 * Reads the posts and categories through the import's cache, so after an
 * import it sends WordPress nothing. The output is committed: the Worker
 * bundles it, and wp-redirects.test.ts checks it.
 */

const wp = new WordPressClient(join(".wp-import", "cache"))
// Only what the import imports: a post with no title to give it is skipped
// there (index.ts), so it must not get an address that 404s.
const posts = (await fetchPosts(wp, null)).filter(
  (post) => cleanTitle(post.title.rendered) || fallbackTitle(post.content.rendered)
)
const categories = await wp.get<{ slug: string; link: string }[]>(
  "/wp-json/wp/v2/categories?per_page=100&_fields=id,slug,parent,link"
)
const redirects = buildRedirects({ posts, categories })
await writeFile("src/data/wp-redirects.json", `${JSON.stringify(redirects, null, 2)}\n`)
console.log(
  `Wrote ${Object.keys(redirects.paths).length} paths and ${Object.keys(redirects.ids).length} ids to src/data/wp-redirects.json`
)
