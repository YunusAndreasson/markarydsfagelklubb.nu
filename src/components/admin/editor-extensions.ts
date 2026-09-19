import { mergeAttributes, Node } from "@tiptap/core"
import Image from "@tiptap/extension-image"
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
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
  SiteTable.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  Embed,
]
