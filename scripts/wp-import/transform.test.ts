import { describe, expect, it } from "vitest"
import { SITE_MEDIA_PUBLIC_PREFIX } from "../../src/lib/media"
import { sanitizeContent } from "../../src/lib/sanitize"
import {
  type Attachment,
  cleanExcerpt,
  cleanTitle,
  plannedPrefix,
  type ResolveContext,
  siteSlug,
  stripSizeSuffix,
  transformBody,
  uuidV5,
} from "./transform"

const UPLOADS = "https://markarydsfagelklubb.nu/wp-content/uploads"

const strandskata: Attachment = {
  id: "10151",
  url: `${UPLOADS}/2026/06/familj-strand.jpg`,
  width: 1343,
  height: 895,
}

function context(attachments: Attachment[] = [strandskata]): ResolveContext {
  return {
    attachmentsById: new Map(attachments.map((attachment) => [attachment.id, attachment])),
    attachmentsByUrl: new Map(attachments.map((attachment) => [attachment.url, attachment])),
    postDate: new Date("2026-06-23T04:39:37Z"),
  }
}

/** What the importer stores: the transform, then the site's one sanitizer. */
function stored(html: string, ctx = context()) {
  const result = transformBody(html, ctx)
  return { ...result, html: sanitizeContent(result.html) }
}

describe("transformBody", () => {
  it("turns a WordPress figure into a site image and its caption into a paragraph", () => {
    const { html, images, captions } = stored(
      `<figure class="wp-block-image size-large is-resized"><img src="${UPLOADS}/2026/06/familj-strand-1032x688.jpg" alt="" class="wp-image-10151" width="504" height="336" srcset="${UPLOADS}/2026/06/familj-strand-300x200.jpg 300w" sizes="(max-width: 504px) 100vw, 504px" /><figcaption>Strandskata <strong>(Haematopus ostralegus</strong>). <em>Foto: Olof Bergqvist.&nbsp; </em> </figcaption></figure>`
    )
    expect(images).toHaveLength(1)
    expect(images[0]?.source).toBe(strandskata.url)
    expect(images[0]?.image.widths).toEqual([480, 960, 1343])
    expect(captions).toBe(1)
    expect(html).toContain(`src="${SITE_MEDIA_PUBLIC_PREFIX}2026/06/`)
    expect(html).toContain('width="1343" height="895"')
    expect(html).toContain(
      "<p>Strandskata <strong>(Haematopus ostralegus</strong>). <em>Foto: Olof Bergqvist."
    )
    expect(html).not.toContain("figure")
    expect(html).not.toContain("markarydsfagelklubb.nu")
  })

  it("finds the original from the URL when the class is missing", () => {
    const { images } = stored(
      `<p><img src="${UPLOADS}/2026/06/familj-strand-300x200.jpg" alt="Strandskata"></p>`
    )
    expect(images[0]?.source).toBe(strandskata.url)
    expect(images[0]?.image.alt).toBe("Strandskata")
    expect(images[0]?.guessed).toBe(false)
  })

  it("guesses the original of an image the export doesn't know, and says so", () => {
    const { images, html } = stored(
      `<img src="https://www.markarydsfagelklubb.nu/wp-content/uploads/2019/04/ugla-1024x683.jpg">`
    )
    expect(images[0]).toMatchObject({
      source: `${UPLOADS}/2019/04/ugla.jpg`,
      guessed: true,
      hotlinked: false,
    })
    expect(html).toContain("<img")
  })

  it("plans a hotlinked image for copying", () => {
    const { images, html } = stored(`<p><img src="https://vinterfaglar.se/bild.jpg" alt=""></p>`)
    expect(images[0]).toMatchObject({ source: "https://vinterfaglar.se/bild.jpg", hotlinked: true })
    // The post's month, since the URL carries none.
    expect(images[0]?.image.storage_prefix).toMatch(/^2026\/06\//)
    expect(html).toContain(SITE_MEDIA_PUBLIC_PREFIX)
  })

  it("unwraps a link to the uploaded image file", () => {
    const { html } = stored(
      `<a href="${UPLOADS}/2026/06/familj-strand.jpg"><img src="${UPLOADS}/2026/06/familj-strand-1032x688.jpg" class="wp-image-10151"></a>`
    )
    expect(html).not.toContain("<a")
    expect(html).toContain("<img")
  })

  it("records linked documents and makes page links relative", () => {
    const { html, files, internalLinks } = stored(
      `<p><a href="${UPLOADS}/2024/02/Cinclus-1-2024.pdf">Cinclus</a> och <a href="https://markarydsfagelklubb.nu/medlemsskap/">bli medlem</a></p>`
    )
    expect(files).toEqual([{ source: `${UPLOADS}/2024/02/Cinclus-1-2024.pdf`, kind: "pdf" }])
    expect(internalLinks).toEqual(["/medlemsskap/"])
    expect(html).toContain('href="/medlemsskap/"')
  })

  it("keeps the formatting the sanitizer would otherwise flatten", () => {
    const { html } = stored("<h1>Rubrik</h1><p><b>fet</b> och <i>kursiv</i></p><h5>liten</h5>")
    expect(html).toBe(
      "<h2>Rubrik</h2><p><strong>fet</strong> och <em>kursiv</em></p><h4>liten</h4>"
    )
  })

  it("drops WordPress's spacer paragraphs and edge line breaks", () => {
    const { html } = stored(
      "<p> <br />Text<br /> </p>\n\n\n\n<p>&nbsp;</p>\n<p><strong>Mer</strong><br></p>"
    )
    expect(html).toBe("<p>Text</p>\n\n<p><strong>Mer</strong></p>")
  })

  it("drops an empty caption rather than leaving an empty paragraph", () => {
    const { captions, html } = stored(
      `<figure><img src="${UPLOADS}/2026/06/familj-strand.jpg" class="wp-image-10151"><figcaption> &nbsp;</figcaption></figure>`
    )
    expect(captions).toBe(0)
    expect(html).not.toContain("<p>")
  })
})

describe("the small helpers", () => {
  it("decodes a rendered title", () => {
    expect(cleanTitle("Nattfåglar &#8211; 5 juni")).toBe("Nattfåglar – 5 juni")
    expect(cleanTitle("fredagen  5 juni &amp; mer")).toBe("fredagen 5 juni & mer")
  })

  it("turns any WordPress slug into a valid site slug", () => {
    expect(siteSlug("programandring")).toBe("programandring")
    expect(siteSlug("%c3%a5rsm%c3%b6te-2024")).toBe("arsmote-2024")
    expect(siteSlug("--Hej  där--")).toBe("hej-dar")
  })

  it("gives a file the same storage prefix on every run", () => {
    expect(uuidV5("a")).toBe(uuidV5("a"))
    expect(uuidV5("a")).not.toBe(uuidV5("b"))
    expect(uuidV5("a")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
    expect(plannedPrefix(strandskata.url, new Date())).toMatch(
      /^2026\/06\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it("finds the original behind a resized copy", () => {
    expect(stripSizeSuffix(`${UPLOADS}/2026/06/familj-strand-1032x688.jpg`)).toBe(strandskata.url)
    expect(stripSizeSuffix(strandskata.url)).toBe(strandskata.url)
  })

  it("keeps only a hand-written excerpt, as plain text", () => {
    expect(cleanExcerpt(undefined)).toBe("")
    expect(cleanExcerpt("<p>Vid sammanräkningen &amp; mer</p>\n")).toBe("Vid sammanräkningen & mer")
  })
})
