import { describe, expect, it } from "vitest"

import { linkPhones, linkPhotos, renderBody, withGalleries } from "./article-body"
import { SITE_MEDIA_PUBLIC_PREFIX } from "./media"

const figure = (n: number) => `<figure><img src="${n}.webp"><figcaption>${n}</figcaption></figure>`

describe("withGalleries", () => {
  it("wraps a run of photos", () => {
    expect(withGalleries(`<p>a</p>${figure(1)}\n${figure(2)}<p>b</p>`)).toBe(
      `<p>a</p><div class="content-gallery">${figure(1)}\n${figure(2)}</div><p>b</p>`
    )
  })

  it("leaves a lone photo in the column", () => {
    const html = `<p>a</p>${figure(1)}<p>b</p>${figure(2)}`
    expect(withGalleries(html)).toBe(html)
  })

  it("counts plain images too, and keeps separate runs apart", () => {
    const img = '<img src="x.webp">'
    expect(withGalleries(`${img}${figure(1)}<p>a</p>${img}${img}`)).toBe(
      `<div class="content-gallery">${img}${figure(1)}</div><p>a</p><div class="content-gallery">${img}${img}</div>`
    )
  })
})

describe("linkPhones", () => {
  it("links the styles the club writes numbers in", () => {
    for (const [text, digits] of [
      ["0701-74 06 05", "0701740605"],
      ["0701 – 740605", "0701740605"],
      ["070-1740606", "0701740606"],
      ["0701 -740607", "0701740607"],
      ["0701740605", "0701740605"],
    ] as const) {
      expect(linkPhones(`<p>Ring ${text}.</p>`), text).toBe(
        `<p>Ring <a href="tel:${digits}">${text}</a>.</p>`
      )
    }
  })

  it("leaves other numbers alone", () => {
    for (const text of [
      "bankgiro 5661-4969",
      "Swish 123 267 61 61",
      "2025-10-20",
      "kl. 08.00",
      "01-02",
      "år 2026 kl 0800",
    ]) {
      expect(linkPhones(`<p>${text}</p>`), text).toBe(`<p>${text}</p>`)
    }
  })

  it("never touches an attribute or a link's own text", () => {
    const html = '<img alt="0701-740605" src="x"><a href="/a">0701-740605</a>'
    expect(linkPhones(html)).toBe(html)
  })

  it("picks up again after a link", () => {
    expect(linkPhones('<a href="/a">x</a> 0701-740605')).toBe(
      '<a href="/a">x</a> <a href="tel:0701740605">0701-740605</a>'
    )
  })
})

describe("renderBody", () => {
  it("does both", () => {
    const out = renderBody(`${figure(1)}${figure(2)}<p>0701-740605</p>`)
    expect(out).toContain("content-gallery")
    expect(out).toContain("tel:0701740605")
  })
})

describe("linkPhotos", () => {
  const url = (width: number) => `${SITE_MEDIA_PUBLIC_PREFIX}2026/05/a/${width}.webp`
  const img = `<img src="${url(960)}" srcset="${url(480)} 480w, ${url(1600)} 1600w" width="2400" height="1600" alt="Sävsparv" />`

  it("links a photo to its largest file, at that file's size", () => {
    expect(linkPhotos(`<p>a</p>${img}`)).toBe(
      `<p>a</p><a class="photo" href="${url(1600)}" data-pswp-width="1600" data-pswp-height="1067">${img}</a>`
    )
  })

  it("leaves a photo that already sits in a link", () => {
    const html = `<a href="/artiklar/x">${img}</a>`
    expect(linkPhotos(html)).toBe(html)
  })

  it("leaves other images alone", () => {
    const html = '<img src="https://example.org/x.jpg" width="10" height="10" />'
    expect(linkPhotos(html)).toBe(html)
  })

  it("gives no size when the image doesn't say", () => {
    const bare = `<img src="${url(960)}" alt="" />`
    expect(linkPhotos(bare)).toBe(`<a class="photo" href="${url(960)}">${bare}</a>`)
  })

  it("still makes a contact sheet of linked photos", () => {
    expect(renderBody(`${img}${img}`)).toMatch(
      /^<div class="content-gallery"><a class="photo"[\s\S]*<\/a><\/div>$/
    )
  })
})
