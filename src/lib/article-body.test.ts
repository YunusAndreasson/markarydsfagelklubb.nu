import { describe, expect, it } from "vitest"

import { linkPhones, renderBody, withGalleries } from "./article-body"

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
      ["070-174 06 05", "070-174 06 05"],
      ["070-174 06 05", "070-174 06 05"],
      ["070-174 06 06", "070-174 06 06"],
      ["070-174 06 07", "070-174 06 07"],
      ["070-174 06 05", "070-174 06 05"],
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
    const html = '<img alt="070-174 06 05" src="x"><a href="/a">070-174 06 05</a>'
    expect(linkPhones(html)).toBe(html)
  })

  it("picks up again after a link", () => {
    expect(linkPhones('<a href="/a">x</a> 070-174 06 05')).toBe(
      '<a href="/a">x</a> <a href="tel:070-174 06 05">070-174 06 05</a>'
    )
  })
})

describe("renderBody", () => {
  it("does both", () => {
    const out = renderBody(`${figure(1)}${figure(2)}<p>070-174 06 05</p>`)
    expect(out).toContain("content-gallery")
    expect(out).toContain("tel:070-174 06 05")
  })
})
