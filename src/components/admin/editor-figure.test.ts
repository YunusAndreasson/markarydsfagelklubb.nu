// @vitest-environment happy-dom
import { Editor } from "@tiptap/core"
import { afterEach, describe, expect, it } from "vitest"
import { SITE_MEDIA_PUBLIC_PREFIX } from "@/lib/media"
import { editorExtensions } from "./editor-extensions"

/**
 * The caption commands the toolbar's "Bild" row runs, in a real editor. The
 * round trip through the sanitizer is in src/lib/editor-roundtrip.test.ts.
 */

const IMG = `<img src="${SITE_MEDIA_PUBLIC_PREFIX}2026/09/x/960.webp" alt="Gråhäger" width="1600" height="1067">`

let editor: Editor | null = null
afterEach(() => {
  editor?.destroy()
  editor = null
})

function open(html: string): Editor {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: editorExtensions,
    content: html,
  })
  return editor
}

describe("the figure node", () => {
  it("gives a selected image a caption, with the cursor in it", () => {
    const current = open(`<p>Före</p>${IMG}<p>Efter</p>`)
    current.commands.setNodeSelection(6)
    expect(current.isActive("image")).toBe(true)

    expect(current.commands.addCaption()).toBe(true)
    current.commands.insertContent("Foto: Anna")
    expect(current.isActive("figure")).toBe(true)
    expect(current.getHTML()).toContain("<figure><img")
    expect(current.getHTML()).toContain("<figcaption>Foto: Anna</figcaption></figure><p>Efter</p>")
  })

  it("refuses to caption anything but an image", () => {
    const current = open("<p>Text</p>")
    expect(current.commands.addCaption()).toBe(false)
  })

  it("takes the caption away and leaves the image", () => {
    const current = open(`<figure>${IMG}<figcaption>Foto: Anna</figcaption></figure><p>Efter</p>`)
    current.commands.setTextSelection(3)
    expect(current.commands.removeCaption()).toBe(true)
    expect(current.getHTML()).not.toContain("figure")
    expect(current.getHTML()).toMatch(/^<img [^>]*alt="Gråhäger"/)
  })

  it("ends the caption on Enter instead of splitting the photo in two", () => {
    const current = open(`<figure>${IMG}<figcaption>Foto</figcaption></figure>`)
    current.commands.setTextSelection(5)
    // As the browser delivers it. The `keyboardShortcut` command replays only
    // a key's steps and loses where it put the cursor.
    const enter = new KeyboardEvent("keydown", { key: "Enter" })
    current.view.someProp("handleKeyDown", (handle) => handle(current.view, enter))
    current.commands.insertContent("Nästa stycke")
    const html = current.getHTML()
    expect(html.match(/<figure>/g)).toHaveLength(1)
    expect(html).toContain("<figcaption>Foto</figcaption></figure><p>Nästa stycke</p>")
  })
})
