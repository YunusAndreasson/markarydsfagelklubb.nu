import { describe, expect, it } from "vitest"

import { type MediaImage, SITE_MEDIA_PUBLIC_PREFIX } from "./media"
import { bodyImages, isHeroWorthy, pickTeaserImage, teaserText } from "./teaser"

const url = (name: string, width: number) =>
  `${SITE_MEDIA_PUBLIC_PREFIX}2026/05/${name}/${width}.webp`

/** As the WordPress import writes it: src, srcset, sizes, width, height, alt, loading. */
function imported(name: string, width: number, height: number, alt = ""): string {
  return `<img src="${url(name, 960)}" srcset="${url(name, 480)} 480w, ${url(name, 960)} 960w" sizes="(min-width: 40rem) 38rem, 100vw" width="${width}" height="${height}" alt="${alt}" loading="lazy" />`
}

/** As the editor writes it: src, alt, title, width, height, srcset, sizes, loading. */
function edited(name: string, width: number, height: number, alt = ""): string {
  return `<img src="${url(name, 960)}" alt="${alt}" width="${width}" height="${height}" srcset="${url(name, 480)} 480w, ${url(name, 960)} 960w" sizes="(min-width: 40rem) 38rem, 100vw" loading="lazy" />`
}

describe("bodyImages", () => {
  it("reads attributes by name, whichever order they were written in", () => {
    for (const tag of [
      imported("a", 2560, 1707, "Sävsparv"),
      edited("a", 2560, 1707, "Sävsparv"),
    ]) {
      expect(bodyImages(`<p>Text</p>${tag}`)).toEqual([
        {
          src: url("a", 960),
          srcset: `${url("a", 480)} 480w, ${url("a", 960)} 960w`,
          width: 2560,
          height: 1707,
          alt: "Sävsparv",
        },
      ])
    }
  })

  it("decodes the entities sanitize-html writes, &amp; last", () => {
    const [image] = bodyImages(
      imported("a", 1000, 700, "Gås &amp; and &quot;Kalle&quot; &amp;lt;3")
    )
    expect(image?.alt).toBe('Gås & and "Kalle" &lt;3')
  })

  it("finds an image inside a paragraph", () => {
    expect(bodyImages(`<p>${imported("a", 1000, 700)}</p>`)).toHaveLength(1)
  })

  it("skips anything that isn't the site's own media", () => {
    const foreign = '<img src="https://example.com/a.jpg" width="1000" height="700" alt="" />'
    const mixedSrcset = `<img src="${url("a", 960)}" srcset="https://example.com/a.jpg 480w" width="1000" height="700" alt="" />`
    expect(bodyImages(foreign + mixedSrcset)).toEqual([])
  })

  it("takes the width from the srcset when the tag has none, and leaves the height unknown", () => {
    const bare = `<img src="${url("a", 960)}" srcset="${url("a", 480)} 480w, ${url("a", 960)} 960w" alt="" />`
    const [image] = bodyImages(bare)
    expect(image?.width).toBe(960)
    expect(image?.height).toBe(0)
    expect(image && isHeroWorthy(image)).toBe(false)
  })

  it("stops at the limit", () => {
    const html = [1, 2, 3].map((n) => imported(`i${n}`, 1000, 700)).join("")
    expect(bodyImages(html, 2)).toHaveLength(2)
  })
})

describe("pickTeaserImage", () => {
  const cover: MediaImage = {
    storage_prefix: "2026/09/11111111-1111-1111-1111-111111111111",
    format: "webp",
    widths: [480, 960],
    width: 1200,
    height: 800,
    alt: "Omslag",
  }

  it("prefers the cover the editor chose", () => {
    const image = pickTeaserImage(cover, imported("body", 2560, 1707))
    expect(image?.alt).toBe("Omslag")
    expect(image?.width).toBe(1200)
  })

  it("prefers a large landscape photo over an earlier portrait one", () => {
    const html = imported("portrait", 1536, 2048) + imported("landscape", 2560, 1707)
    expect(pickTeaserImage(null, html)?.src).toBe(url("landscape", 960))
  })

  it("falls back to the first photo wide enough for a tile", () => {
    const html = imported("tiny", 300, 200) + imported("portrait", 768, 1024)
    expect(pickTeaserImage(null, html)?.src).toBe(url("portrait", 960))
  })

  it("gives none when every photo is too small, or there is none", () => {
    expect(pickTeaserImage(null, imported("tiny", 300, 200))).toBeNull()
    expect(pickTeaserImage(null, "<p>Bara text.</p>")).toBeNull()
  })

  it("looks only at the opening photos", () => {
    const portraits = [1, 2, 3, 4, 5, 6].map((n) => imported(`p${n}`, 768, 1024)).join("")
    const html = portraits + imported("late", 2560, 1707)
    expect(pickTeaserImage(null, html)?.src).toBe(url("p1", 960))
  })
})

describe("isHeroWorthy", () => {
  const image = { src: "", srcset: "", alt: "" }
  it("wants a large landscape photo", () => {
    expect(isHeroWorthy({ ...image, width: 1280, height: 853 })).toBe(true)
    expect(isHeroWorthy({ ...image, width: 1536, height: 2048 })).toBe(false)
    expect(isHeroWorthy({ ...image, width: 1000, height: 1000 })).toBe(false)
    expect(isHeroWorthy({ ...image, width: 720, height: 480 })).toBe(false)
  })
})

describe("teaserText", () => {
  it("takes the first paragraph as plain text", () => {
    const html =
      "<p>Denna vackra <strong>försommarkväll</strong> gick färden<br />mot Verum.</p><p>Nästa.</p>"
    expect(teaserText(html, "Skeingeborg")).toBe(
      "Denna vackra försommarkväll gick färden mot Verum."
    )
  })

  it("skips empty paragraphs and a paragraph holding an image", () => {
    const html = `<p></p><p> </p><p>${imported("a", 1000, 700)} Text bredvid bilden.</p><p>Första riktiga stycket.</p>`
    expect(teaserText(html, "Titel")).toBe("Första riktiga stycket.")
  })

  it("skips the caption the import wrote after an image", () => {
    const html = `${imported("a", 1000, 700)}<p>Skeingesjön. Bild av Lars-Erik.</p><p>Sedan gick vi vidare.</p>`
    expect(teaserText(html, "Titel")).toBe("Sedan gick vi vidare.")
    const wrapped = `<p>${imported("a", 1000, 700)}</p><p>Bildtext.</p><p>Brödtext.</p>`
    expect(teaserText(wrapped, "Titel")).toBe("Brödtext.")
  })

  it("skips a photo credit wherever it sits", () => {
    expect(teaserText("<p>Text och foto: Anna</p><p>Det var kallt.</p>", "Titel")).toBe(
      "Det var kallt."
    )
  })

  it("drops a first line that repeats the title, and skips a paragraph that is only the title", () => {
    const html = "<p><strong>Årsfest!</strong><br />Välkommen till årsfesten.</p>"
    expect(teaserText(html, "Årsfest")).toBe("Välkommen till årsfesten.")
    expect(teaserText("<p><strong>ÅRSFEST</strong></p><p>Mat och fika.</p>", "Årsfest")).toBe(
      "Mat och fika."
    )
  })

  it("leaves prose alone that merely starts with the title's words", () => {
    expect(teaserText("<p>Ekebacken 26 maj var en fin kväll.</p>", "Ekebacken 26 maj")).toBe(
      "Ekebacken 26 maj var en fin kväll."
    )
  })

  it("decodes entities and collapses no-break spaces", () => {
    expect(teaserText("<p>Gås &amp; and  i &lt;dag&gt;</p>", "Titel")).toBe("Gås & and i <dag>")
  })

  it("cuts at a word boundary with an ellipsis", () => {
    const long = `<p>${"ordet ".repeat(60)}</p>`
    const text = teaserText(long, "Titel", 40)
    expect(text.endsWith("ordet…")).toBe(true)
    expect(text.length).toBeLessThanOrEqual(41)
  })

  it("gives an empty string when there is nothing to say", () => {
    expect(teaserText("", "Titel")).toBe("")
    expect(teaserText(imported("a", 1000, 700), "Titel")).toBe("")
  })
})
