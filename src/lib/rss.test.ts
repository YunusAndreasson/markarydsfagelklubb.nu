import { describe, expect, it } from "vitest"
import { escapeXml, type FeedItem, renderRss } from "./rss"

const channel = {
  title: "Markaryds Fågelklubb",
  description: "Nyheter och exkursionsreferat från Markaryds Fågelklubb.",
  link: "https://example.test/artiklar",
  self: "https://example.test/feed",
}

const item: FeedItem = {
  title: "Ny häckfågel i kommunen!",
  link: "https://example.test/artiklar/ny-hackfagel-i-kommunen",
  publishedAt: "2026-06-23T04:39:37Z",
  description: "Ett strandskatepar har sedan i våras hållit till på gamla bruksområdet.",
  category: "Referat",
  image: { url: "https://media.example.test/2026/06/x/960.webp", width: 960, height: 640 },
}

describe("renderRss", () => {
  it("describes the channel, with its own address for readers", () => {
    const xml = renderRss(channel, [item])
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"')).toBe(true)
    expect(xml).toContain("<title>Markaryds Fågelklubb</title>")
    expect(xml).toContain("<link>https://example.test/artiklar</link>")
    expect(xml).toContain("<language>sv-SE</language>")
    expect(xml).toContain(
      '<atom:link href="https://example.test/feed" rel="self" type="application/rss+xml"/>'
    )
    expect(xml).toContain("<lastBuildDate>Tue, 23 Jun 2026 04:39:37 GMT</lastBuildDate>")
    expect(xml.endsWith("</channel>\n</rss>")).toBe(true)
  })

  it("writes an item with its permalink, date, category, opening line and photo", () => {
    expect(renderRss(channel, [item])).toContain(
      "<item><title>Ny häckfågel i kommunen!</title>" +
        "<link>https://example.test/artiklar/ny-hackfagel-i-kommunen</link>" +
        '<guid isPermaLink="true">https://example.test/artiklar/ny-hackfagel-i-kommunen</guid>' +
        "<pubDate>Tue, 23 Jun 2026 04:39:37 GMT</pubDate>" +
        "<category>Referat</category>" +
        "<description>Ett strandskatepar har sedan i våras hållit till på gamla bruksområdet.</description>" +
        '<media:content url="https://media.example.test/2026/06/x/960.webp" medium="image" width="960" height="640"/>' +
        "</item>"
    )
  })

  it("leaves out what an article doesn't have", () => {
    const xml = renderRss(channel, [{ ...item, category: null, description: "", image: null }])
    expect(xml).not.toContain("<category>")
    expect(xml).not.toContain("<description>Ett")
    expect(xml).not.toContain("<media:content")
  })

  it("is still a valid feed with no articles", () => {
    const xml = renderRss(channel, [])
    expect(xml).not.toContain("<item>")
    expect(xml).not.toContain("<lastBuildDate>")
  })
})

describe("escapeXml", () => {
  it("escapes markup and quotes", () => {
    expect(escapeXml(`Fåglar & "fika" <i> 's`)).toBe(
      "Fåglar &amp; &quot;fika&quot; &lt;i&gt; &apos;s"
    )
  })

  it("drops control characters XML refuses, and keeps tabs and newlines", () => {
    expect(escapeXml("a\u0000b\u000bc\td\ne")).toBe("abc\td\ne")
  })
})
