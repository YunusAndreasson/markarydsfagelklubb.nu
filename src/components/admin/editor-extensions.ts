import { mergeAttributes, Node } from "@tiptap/core"
import Image from "@tiptap/extension-image"
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
import { NodeSelection, TextSelection } from "@tiptap/pm/state"
import StarterKit from "@tiptap/starter-kit"
import { isAllowedEmbed } from "@/lib/embeds"

/**
 * What the editor can hold, and therefore exactly what the sanitizer keeps
 * (src/lib/sanitize.ts). `editor-roundtrip.test.ts` renders every node and
 * mark defined here and checks that a save changes nothing. Change the two
 * together.
 *
 * No React in this module, so the test can load it in plain Node.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    embed: {
      /** Insert an Artportalen or Google Maps embed; other sources are refused. */
      setEmbed: (attributes: { src: string; title: string }) => ReturnType
    }
    figure: {
      /** Give the selected image a caption, and put the cursor in it. */
      addCaption: () => ReturnType
      /** Take the caption away: the figure becomes the plain image again. */
      removeCaption: () => ReturnType
    }
  }
}

/** Site images carry their responsive variants and are lazy unless told otherwise. */
const SiteImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      srcset: { default: null },
      sizes: { default: null },
      width: { default: null },
      height: { default: null },
      loading: { default: "lazy" },
    }
  },
})

/** What a photo carries, as an image or inside a figure. */
const PHOTO_ATTRIBUTES = [
  "src",
  "srcset",
  "sizes",
  "width",
  "height",
  "alt",
  "title",
  "loading",
] as const

/**
 * A photo with a caption: `<figure><img><figcaption>…</figcaption></figure>`.
 * The photo's attributes live on the node; the caption is its text, so it can
 * hold an italic scientific name or a link. A photo without a caption stays an
 * image node, and the sanitizer stores an emptied caption's figure as one.
 */
export const Figure = Node.create({
  name: "figure",
  group: "block",
  content: "inline*",
  // Backspace at the caption's start must not pull it into the paragraph above.
  isolating: true,

  addAttributes() {
    return Object.fromEntries(
      PHOTO_ATTRIBUTES.map((name) => [
        name,
        {
          default: name === "loading" ? "lazy" : null,
          parseHTML: (element: HTMLElement) => element.querySelector("img")?.getAttribute(name),
        },
      ])
    )
  },

  parseHTML() {
    return [
      {
        tag: "figure",
        contentElement: "figcaption",
        // Only a photo with a caption; anything else is read as its parts.
        getAttrs: (element) =>
          element.querySelector(":scope > img") && element.querySelector(":scope > figcaption")
            ? {}
            : false,
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", ["img", HTMLAttributes], ["figcaption", 0]]
  },

  addCommands() {
    return {
      addCaption:
        () =>
        ({ state, tr, dispatch }) => {
          const { selection } = state
          if (!(selection instanceof NodeSelection) || selection.node.type.name !== "image") {
            return false
          }
          if (dispatch) {
            tr.replaceSelectionWith(this.type.create(selection.node.attrs))
            tr.setSelection(TextSelection.create(tr.doc, selection.from + 1)).scrollIntoView()
          }
          return true
        },
      removeCaption:
        () =>
        ({ state, tr, dispatch }) => {
          const { selection } = state
          let at: number | null = null
          if (selection instanceof NodeSelection && selection.node.type === this.type) {
            at = selection.from
          } else if (selection.$from.parent.type === this.type) {
            at = selection.$from.before()
          }
          const figure = at === null ? null : state.doc.nodeAt(at)
          if (at === null || !figure) return false
          if (dispatch) {
            tr.replaceWith(at, at + figure.nodeSize, state.schema.nodes.image.create(figure.attrs))
            tr.setSelection(NodeSelection.create(tr.doc, at))
          }
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      // Enter ends the caption and starts a paragraph under the photo, rather
      // than splitting the figure into two copies of it.
      Enter: ({ editor }) => {
        const { $from } = editor.state.selection
        if ($from.parent.type !== this.type) return false
        const after = $from.after()
        return editor
          .chain()
          .insertContentAt(after, { type: "paragraph" })
          .setTextSelection(after + 1)
          .run()
      },
    }
  },
})

/**
 * Tables serialise as plain markup. Tiptap's own renderHTML adds inline
 * min-width styles and a <colgroup>; the site's stylesheet decides layout.
 */
const SiteTable = Table.extend({
  renderHTML({ HTMLAttributes }) {
    return ["table", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), ["tbody", 0]]
  },
})

/** An iframe from one of the embed sources (src/lib/embeds.ts), and nothing else. */
export const Embed = Node.create({
  name: "embed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      title: { default: null },
    }
  },

  parseHTML() {
    return [
      {
        tag: "iframe[src]",
        getAttrs: (element) => (isAllowedEmbed(element.getAttribute("src") ?? "") ? {} : false),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ["iframe", mergeAttributes(HTMLAttributes, { loading: "lazy" })]
  },

  addCommands() {
    return {
      setEmbed:
        (attributes) =>
        ({ commands, state }) =>
          isAllowedEmbed(attributes.src) &&
          // After the selection, never over it: inserting a map must not eat
          // the selected text, or the image that was just inserted.
          commands.insertContentAt(state.selection.to, { type: this.name, attrs: attributes }),
    }
  },
})

export const EDITOR_HEADING_LEVELS = [2, 3, 4] as const

export const editorExtensions = [
  StarterKit.configure({
    // h1 is the page title; code has no place in a club's articles.
    heading: { levels: [...EDITOR_HEADING_LEVELS] },
    code: false,
    codeBlock: false,
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      protocols: ["http", "https", "mailto", "tel"],
      // Same tab, no extra attributes: the sanitizer would only add rel back.
      HTMLAttributes: { target: null, rel: null, class: null },
    },
  }),
  SiteImage.configure({ inline: false, allowBase64: false }),
  Figure,
  SiteTable.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  Embed,
]
