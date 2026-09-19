import { describe, expect, it } from "vitest"

import {
  MESSAGES,
  parseArticleForm,
  parseCategoryForm,
  parseLinkForm,
  parsePageForm,
  parseRouteId,
} from "./content-form"

function form(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

describe("parseArticleForm", () => {
  it("reads a complete article and makes the slug from the title", () => {
    const result = parseArticleForm(
      form({
        title: "  Sträckräkning på Skararps ängar ",
        slug: "",
        excerpt: "Tusentals bofinkar.",
        author_name: "Anna",
        category_id: "3",
        cover_media_id: "",
        body_html: "<p>Text</p>",
        publish_at: "2026-09-19T10:00",
      })
    )
    expect(result).toEqual({
      ok: true,
      value: {
        title: "Sträckräkning på Skararps ängar",
        slug: "strackrakning-pa-skararps-angar",
        excerpt: "Tusentals bofinkar.",
        author_name: "Anna",
        category_id: 3,
        cover_media_id: null,
        body_html: "<p>Text</p>",
        publish_at: new Date("2026-09-19T08:00:00Z"),
      },
    })
  })

  it("reports every problem at once, in Swedish", () => {
    const result = parseArticleForm(
      form({
        title: "",
        slug: "Inte OK",
        category_id: "abc",
        publish_at: "igår",
        excerpt: "x".repeat(401),
      })
    )
    expect(result).toEqual({
      ok: false,
      errors: {
        title: MESSAGES.titleMissing,
        slug: MESSAGES.slugInvalid,
        excerpt: MESSAGES.excerptTooLong,
        category_id: MESSAGES.choiceInvalid,
        publish_at: MESSAGES.publishAtInvalid,
      },
    })
  })

  it("keeps an article from taking the category route's name", () => {
    const result = parseArticleForm(form({ title: "Kategori" }))
    expect(result.ok).toBe(false)
    expect(!result.ok && result.errors.slug).toBe(MESSAGES.slugReserved("kategori"))
  })

  it("leaves the body and cover alone when their islands never loaded", () => {
    const result = parseArticleForm(form({ title: "Utan JavaScript" }))
    expect(result.ok && result.value.body_html).toBeNull()
    expect(result.ok && result.value.cover_media_id).toBeUndefined()
  })

  it("asks for a slug when the title gives none", () => {
    const result = parseArticleForm(form({ title: "???" }))
    expect(!result.ok && result.errors.slug).toBe(MESSAGES.slugMissing)
  })
})

describe("parsePageForm", () => {
  it("reserves the site's routes for top-level pages only", () => {
    const top = parsePageForm(form({ title: "Artiklar" }))
    expect(!top.ok && top.errors.slug).toBe(MESSAGES.slugReserved("artiklar"))
    const nested = parsePageForm(form({ title: "Artiklar", parent_id: "4" }))
    expect(nested.ok).toBe(true)
  })

  it("refuses the page itself or a descendant as parent", () => {
    const result = parsePageForm(form({ title: "Om", parent_id: "7" }), {
      forbiddenParentIds: new Set([5, 7]),
    })
    expect(!result.ok && result.errors.parent_id).toBe(MESSAGES.parentInvalid)
  })

  it("reads the menu checkbox the way browsers send it", () => {
    const shown = parsePageForm(form({ title: "Om", show_in_menu: "on" }))
    const hidden = parsePageForm(form({ title: "Om" }))
    expect(shown.ok && shown.value.show_in_menu).toBe(true)
    expect(hidden.ok && hidden.value.show_in_menu).toBe(false)
  })
})

describe("parseLinkForm", () => {
  it("accepts web, mail and on-site links", () => {
    for (const url of [
      "https://www.artportalen.se/",
      "http://example.se",
      "mailto:webmaster@markarydsfagelklubb.nu",
      "/artiklar",
      "/",
    ]) {
      expect(parseLinkForm(form({ title: "Länk", link_url: url })).ok, url).toBe(true)
    }
  })

  it("refuses script, data and protocol-relative links", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,x",
      "//evil.example/",
      "",
      "artportalen.se",
      "https://",
    ]) {
      const result = parseLinkForm(form({ title: "Länk", link_url: url }))
      expect(!result.ok && result.errors.link_url, url).toBe(MESSAGES.linkUrlInvalid)
    }
  })
})

describe("parseCategoryForm", () => {
  it("needs a name and makes the slug from it", () => {
    expect(parseCategoryForm(form({ name: "Föreningsaktuellt" }))).toEqual({
      ok: true,
      value: { name: "Föreningsaktuellt", slug: "foreningsaktuellt" },
    })
    expect(parseCategoryForm(form({ name: "" }))).toEqual({
      ok: false,
      errors: { name: MESSAGES.nameMissing },
    })
  })
})

describe("parseRouteId", () => {
  it("accepts positive integers only", () => {
    expect(parseRouteId("12")).toBe(12)
    for (const bad of [undefined, "", "0", "-1", "1.5", "12abc", "ny"]) {
      expect(parseRouteId(bad), String(bad)).toBeNull()
    }
  })
})
