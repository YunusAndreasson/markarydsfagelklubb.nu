import type { JSONContent } from "@tiptap/core"
import { generateHTML, generateJSON } from "@tiptap/html/server"
import { describe, expect, it } from "vitest"

import { editorExtensions } from "@/components/admin/editor-extensions"
import { SITE_MEDIA_PUBLIC_PREFIX } from "./media"
import { sanitizeContent } from "./sanitize"

/**
 * The editor and the sanitizer must agree: whatever the editor can produce, a
 * save must keep. Otherwise text silently disappears between "Spara" and the
 * page. This renders every node and mark the editor has, the way the editor
 * serialises them, and saves it.
 */

const IMG = `${SITE_MEDIA_PUBLIC_PREFIX}2026/09/11111111-1111-1111-1111-111111111111`

const text = (value: string, marks: JSONContent["marks"] = []): JSONContent => ({
  type: "text",
  text: value,
  marks,
})
const paragraph = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content })

const everything: JSONContent = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [text("Sträckräkning")] },
    { type: "heading", attrs: { level: 3 }, content: [text("Morgonen")] },
    { type: "heading", attrs: { level: 4 }, content: [text("Arter")] },
    paragraph(
      text("Fet", [{ type: "bold" }]),
      text(" "),
      text("Cinclus cinclus", [{ type: "italic" }]),
      text(" "),
      text("struken", [{ type: "strike" }]),
      text(" "),
      text("understruken", [{ type: "underline" }]),
      { type: "hardBreak" },
      text("Artportalen", [{ type: "link", attrs: { href: "https://www.artportalen.se/" } }]),
      text(" och "),
      text("mejl", [{ type: "link", attrs: { href: "mailto:webmaster@markarydsfagelklubb.nu" } }])
    ),
    {
      type: "bulletList",
      content: [{ type: "listItem", content: [paragraph(text("Bofink"))] }],
    },
    {
      type: "orderedList",
      attrs: { start: 3 },
      content: [{ type: "listItem", content: [paragraph(text("Järnsparv"))] }],
    },
    { type: "blockquote", content: [paragraph(text("Citat"))] },
    { type: "horizontalRule" },
    {
      type: "image",
      attrs: {
        src: `${IMG}/960.webp`,
        srcset: `${IMG}/480.webp 480w, ${IMG}/960.webp 960w, ${IMG}/1600.webp 1600w`,
        sizes: "(min-width: 40rem) 38rem, 100vw",
        width: 1600,
        height: 1067,
        alt: "Strömstare vid Lagan",
        title: "Foto: Anna",
      },
    },
    {
      type: "figure",
      attrs: {
        src: `${IMG}/960.webp`,
        srcset: `${IMG}/480.webp 480w, ${IMG}/960.webp 960w, ${IMG}/1600.webp 1600w`,
        sizes: "(min-width: 40rem) 38rem, 100vw",
        width: 1600,
        height: 1067,
        alt: "Gråhäger i vassen",
      },
      content: [
        text("Gråhäger ("),
        text("Ardea cinerea", [{ type: "italic" }]),
        text(")."),
        { type: "hardBreak" },
        text("Foto: Anna"),
      ],
    },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", content: [paragraph(text("Datum"))] },
            { type: "tableHeader", content: [paragraph(text("Aktivitet"))] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [paragraph(text("21 feb"))] },
            { type: "tableCell", content: [paragraph(text("Ugglespaning"))] },
          ],
        },
      ],
    },
    {
      type: "embed",
      attrs: { src: "https://www.google.com/maps/embed?pb=!1m18", title: "Karta över Hammarsjön" },
    },
  ],
}

// sanitize-html always writes void elements as <br />; the editor writes <br>.
const normaliseVoid = (html: string) => html.replace(/\s*\/>/g, ">")

describe("the editor and the sanitizer", () => {
  it("keep every node and mark the editor can produce", () => {
    const html = generateHTML(everything, editorExtensions)

    // Guard the fixture itself: each construct really is in the markup.
    for (const tag of [
      "<h2>",
      "<h3>",
      "<h4>",
      "<strong>",
      "<em>",
      "<s>",
      "<u>",
      "<br",
      "<a ",
      "<ul>",
      '<ol start="3">',
      "<blockquote>",
      "<hr",
      "<img ",
      "<figure><img ",
      "<figcaption>",
      "<table>",
      "<th ",
      "<td ",
      "<iframe ",
    ]) {
      expect(html, tag).toContain(tag)
    }

    expect(normaliseVoid(sanitizeContent(html))).toBe(normaliseVoid(html))
  })

  it("open a stored captioned photo as a figure and save it unchanged", () => {
    const img = `<img src="${IMG}/960.webp" width="1600" height="1067" alt="Gråhäger" loading="lazy">`
    const stored = `<figure>${img}<figcaption>Gråhäger (<em>Ardea cinerea</em>). Foto: Anna</figcaption></figure>`
    const json = generateJSON(stored, editorExtensions)
    expect(json.content?.[0]?.type).toBe("figure")
    expect(normaliseVoid(sanitizeContent(generateHTML(json, editorExtensions)))).toBe(stored)
  })

  it("open a figure without a caption as a plain image", () => {
    const json = generateJSON(
      `<figure><img src="${IMG}/960.webp" alt=""></figure>`,
      editorExtensions
    )
    expect(json.content?.[0]?.type).toBe("image")
  })
})
