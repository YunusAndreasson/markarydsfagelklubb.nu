/**
 * The articles as an RSS 2.0 feed (`/feed`, docs/design.md, "RSS"), for feed
 * readers and for the tools that post a club's news to its Facebook page.
 * WordPress served its feed at `/feed/`, and the site 301s that to `/feed`, so
 * a reader subscribed to the old site keeps getting the news.
 *
 * Pure: the route loads the articles and passes them in.
 */

export type FeedItem = {
  title: string
  /** Absolute URL of the article. Also its permanent id. */
  link: string
  /** ISO timestamp. */
  publishedAt: string
  /** The opening line, plain text. */
  description: string
  category: string | null
  /** Absolute URL of the article's photo, if it has one. */
  image: { url: string; width: number; height: number } | null
}

export type FeedChannel = {
  title: string
  description: string
  /** The page the feed mirrors (`/artiklar`), absolute. */
  link: string
  /** The feed's own URL, absolute. */
  self: string
}

/**
 * XML 1.0 refuses most control characters outright, and a single one makes a
 * strict reader drop the whole feed. Text pasted from Word has carried them.
 */
function withoutControlCharacters(value: string): string {
  let out = ""
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d) out += char
  }
  return out
}

export function escapeXml(value: string): string {
  return withoutControlCharacters(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

/** RSS dates are RFC 822; `toUTCString` writes the RFC 1123 form it allows. */
const rssDate = (iso: string) => new Date(iso).toUTCString()

const element = (name: string, value: string) => `<${name}>${escapeXml(value)}</${name}>`

function renderItem(item: FeedItem): string {
  const parts = [
    element("title", item.title),
    element("link", item.link),
    `<guid isPermaLink="true">${escapeXml(item.link)}</guid>`,
    element("pubDate", rssDate(item.publishedAt)),
    item.category ? element("category", item.category) : null,
    item.description ? element("description", item.description) : null,
    item.image
      ? `<media:content url="${escapeXml(item.image.url)}" medium="image" width="${item.image.width}"${item.image.height > 0 ? ` height="${item.image.height}"` : ""}/>`
      : null,
  ]
  return `<item>${parts.filter(Boolean).join("")}</item>`
}

export function renderRss(channel: FeedChannel, items: readonly FeedItem[]): string {
  const newest = items[0]
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">',
    "<channel>",
    element("title", channel.title),
    element("link", channel.link),
    element("description", channel.description),
    "<language>sv-SE</language>",
    `<atom:link href="${escapeXml(channel.self)}" rel="self" type="application/rss+xml"/>`,
    // The newest article's date, not the time of the request: the feed only
    // changes when an article does, and a reader can tell.
    newest ? element("lastBuildDate", rssDate(newest.publishedAt)) : null,
    ...items.map(renderItem),
    "</channel>",
    "</rss>",
  ]
    .filter(Boolean)
    .join("\n")
}
