import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import {
  BoldIcon,
  CodeXmlIcon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  ImagePlusIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MapIcon,
  MinusIcon,
  QuoteIcon,
  Redo2Icon,
  StrikethroughIcon,
  TableIcon,
  UnderlineIcon,
  Undo2Icon,
} from "lucide-react"
import { type ReactNode, useId, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { isAllowedEmbed } from "@/lib/embeds"
import { COLUMN_SIZES, mediaFallbackUrl, mediaSrcset } from "@/lib/media"
import { editorExtensions } from "./editor-extensions"
import { ImageUpload } from "./ImageUpload"

type Props = {
  /** The form field that carries the HTML. */
  name: string
  initialHtml: string
  supabaseUrl: string
  supabasePublishableKey: string
  /** Labels the editing area, e.g. "Brödtext". */
  label: string
}

type Panel = "link" | "image" | "embed" | null

/** A link the editor accepts: web, mail, phone, or a path on this site. */
const LINK_PATTERN = /^(https?:\/\/\S+|mailto:\S+|tel:\S+|\/\S*)$/

/** Google Maps hands out a whole <iframe>; take its src. */
function embedSource(input: string): string {
  const fromIframe = input.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i)?.[1]
  return (fromIframe ?? input).trim().replaceAll("&amp;", "&")
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className="size-11 sm:size-9"
    >
      {children}
    </Button>
  )
}

/**
 * The WYSIWYG editor for article and page bodies (docs/roadmap.md, D5), with
 * an HTML source view. Its HTML goes into a hidden field and is sanitized by
 * the server when the form is saved; what the editor can hold is defined in
 * editor-extensions.ts.
 */
export function RichTextEditor({
  name,
  initialHtml,
  supabaseUrl,
  supabasePublishableKey,
  label,
}: Props) {
  const id = useId()
  const [html, setHtml] = useState(initialHtml)
  const [sourceView, setSourceView] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  const [linkHref, setLinkHref] = useState("")
  const [embedInput, setEmbedInput] = useState("")
  const [embedTitle, setEmbedTitle] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  const editor = useEditor({
    extensions: editorExtensions,
    content: initialHtml,
    editorProps: {
      attributes: {
        class: "content min-h-80 px-4 py-4 outline-none",
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
      },
    },
    onUpdate: ({ editor: current }) => setHtml(current.getHTML()),
  })

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            h2: current.isActive("heading", { level: 2 }),
            h3: current.isActive("heading", { level: 3 }),
            h4: current.isActive("heading", { level: 4 }),
            bold: current.isActive("bold"),
            italic: current.isActive("italic"),
            underline: current.isActive("underline"),
            strike: current.isActive("strike"),
            bulletList: current.isActive("bulletList"),
            orderedList: current.isActive("orderedList"),
            blockquote: current.isActive("blockquote"),
            link: current.isActive("link"),
            inTable: current.isActive("table"),
            image: current.isActive("image"),
            figure: current.isActive("figure"),
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
          }
        : null,
  })

  if (!editor || !state) return null

  const run = (
    command: (chain: ReturnType<typeof editor.chain>) => ReturnType<typeof editor.chain>
  ) => command(editor.chain().focus()).run()

  function togglePanel(next: Panel) {
    setMessage(null)
    if (next === "link" && editor) setLinkHref(editor.getAttributes("link").href ?? "")
    setPanel((current) => (current === next ? null : next))
  }

  function applyLink() {
    if (!editor) return
    const href = linkHref.trim()
    if (!LINK_PATTERN.test(href)) {
      setMessage("Länken måste börja med https://, http://, mailto:, tel: eller / för en sida här.")
      return
    }
    if (editor.state.selection.empty && !editor.isActive("link")) {
      setMessage("Markera först texten som ska bli en länk.")
      return
    }
    run((chain) => chain.extendMarkRange("link").setLink({ href }))
    setPanel(null)
  }

  function applyEmbed() {
    if (!editor) return
    const src = embedSource(embedInput)
    if (!isAllowedEmbed(src)) {
      setMessage(
        "Bara kartor och listor från Artportalen och kartor från Google Maps kan bäddas in."
      )
      return
    }
    if (!embedTitle.trim()) {
      setMessage("Beskriv vad inbäddningen visar, till exempel ”Karta över Hammarsjön”.")
      return
    }
    run((chain) => chain.setEmbed({ src, title: embedTitle.trim() }))
    setEmbedInput("")
    setEmbedTitle("")
    setPanel(null)
  }

  function toggleSourceView() {
    if (!editor) return
    if (sourceView) {
      // Back to WYSIWYG: the editor keeps only what it understands.
      editor.commands.setContent(html)
      setHtml(editor.getHTML())
    } else {
      setHtml(editor.getHTML())
    }
    setPanel(null)
    setSourceView(!sourceView)
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={html} />

      <div className="rounded-2xl border focus-within:ring-3 focus-within:ring-ring/30">
        <div
          role="toolbar"
          aria-label="Formatering"
          className="flex flex-wrap items-center gap-0.5 border-b p-1.5"
        >
          {!sourceView && (
            <>
              <ToolbarButton
                label="Rubrik"
                active={state.h2}
                onClick={() => run((c) => c.toggleHeading({ level: 2 }))}
              >
                <Heading2Icon />
              </ToolbarButton>
              <ToolbarButton
                label="Underrubrik"
                active={state.h3}
                onClick={() => run((c) => c.toggleHeading({ level: 3 }))}
              >
                <Heading3Icon />
              </ToolbarButton>
              <ToolbarButton
                label="Liten rubrik"
                active={state.h4}
                onClick={() => run((c) => c.toggleHeading({ level: 4 }))}
              >
                <Heading4Icon />
              </ToolbarButton>
              <ToolbarButton
                label="Fet"
                active={state.bold}
                onClick={() => run((c) => c.toggleBold())}
              >
                <BoldIcon />
              </ToolbarButton>
              <ToolbarButton
                label="Kursiv"
                active={state.italic}
                onClick={() => run((c) => c.toggleItalic())}
              >
                <ItalicIcon />
              </ToolbarButton>
              <ToolbarButton
                label="Understruken"
                active={state.underline}
                onClick={() => run((c) => c.toggleUnderline())}
              >
                <UnderlineIcon />
              </ToolbarButton>
              <ToolbarButton
                label="Genomstruken"
                active={state.strike}
                onClick={() => run((c) => c.toggleStrike())}
              >
                <StrikethroughIcon />
              </ToolbarButton>
              <ToolbarButton
                label="Punktlista"
                active={state.bulletList}
                onClick={() => run((c) => c.toggleBulletList())}
              >
                <ListIcon />
              </ToolbarButton>
              <ToolbarButton
                label="Numrerad lista"
                active={state.orderedList}
                onClick={() => run((c) => c.toggleOrderedList())}
              >
                <ListOrderedIcon />
              </ToolbarButton>
              <ToolbarButton
                label="Citat"
                active={state.blockquote}
                onClick={() => run((c) => c.toggleBlockquote())}
              >
                <QuoteIcon />
              </ToolbarButton>
              <ToolbarButton label="Avdelare" onClick={() => run((c) => c.setHorizontalRule())}>
                <MinusIcon />
              </ToolbarButton>
              <ToolbarButton
                label="Länk"
                active={state.link || panel === "link"}
                onClick={() => togglePanel("link")}
              >
                <LinkIcon />
              </ToolbarButton>
              <ToolbarButton
                label="Bild"
                active={panel === "image"}
                onClick={() => togglePanel("image")}
              >
                <ImagePlusIcon />
              </ToolbarButton>
              <ToolbarButton
                label="Karta från Artportalen eller Google Maps"
                active={panel === "embed"}
                onClick={() => togglePanel("embed")}
              >
                <MapIcon />
              </ToolbarButton>
              <ToolbarButton
                label="Tabell"
                active={state.inTable}
                onClick={() => run((c) => c.insertTable({ rows: 3, cols: 2, withHeaderRow: true }))}
              >
                <TableIcon />
              </ToolbarButton>
              <ToolbarButton
                label="Ångra"
                disabled={!state.canUndo}
                onClick={() => run((c) => c.undo())}
              >
                <Undo2Icon />
              </ToolbarButton>
              <ToolbarButton
                label="Gör om"
                disabled={!state.canRedo}
                onClick={() => run((c) => c.redo())}
              >
                <Redo2Icon />
              </ToolbarButton>
            </>
          )}
          <Button
            type="button"
            variant={sourceView ? "secondary" : "ghost"}
            aria-pressed={sourceView}
            onClick={toggleSourceView}
            className="ml-auto h-11 sm:h-9"
          >
            <CodeXmlIcon data-icon="inline-start" />
            HTML
          </Button>
        </div>

        {!sourceView && state.inTable && (
          <div role="toolbar" aria-label="Tabell" className="flex flex-wrap gap-1 border-b p-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => run((c) => c.addRowAfter())}
            >
              Ny rad
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => run((c) => c.addColumnAfter())}
            >
              Ny kolumn
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => run((c) => c.deleteRow())}
            >
              Ta bort rad
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => run((c) => c.deleteColumn())}
            >
              Ta bort kolumn
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => run((c) => c.deleteTable())}
            >
              Ta bort tabellen
            </Button>
          </div>
        )}

        {!sourceView && (state.image || state.figure) && (
          <div role="toolbar" aria-label="Bild" className="flex flex-wrap gap-1 border-b p-1.5">
            {state.figure ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => run((c) => c.removeCaption())}
              >
                Ta bort bildtexten
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => run((c) => c.addCaption())}
              >
                Lägg till bildtext
              </Button>
            )}
          </div>
        )}

        {!sourceView && panel === "link" && (
          <div className="flex flex-col gap-3 border-b p-3">
            <Field>
              <FieldLabel htmlFor={`${id}-href`}>Länk till</FieldLabel>
              <Input
                id={`${id}-href`}
                value={linkHref}
                placeholder="https://"
                onChange={(event) => setLinkHref(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    applyLink()
                  }
                }}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={applyLink}>
                {state.link ? "Ändra länken" : "Lägg till länk"}
              </Button>
              {state.link && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    run((c) => c.extendMarkRange("link").unsetLink())
                    setPanel(null)
                  }}
                >
                  Ta bort länken
                </Button>
              )}
            </div>
          </div>
        )}

        {!sourceView && panel === "embed" && (
          <div className="flex flex-col gap-3 border-b p-3">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`${id}-embed`}>Adress eller inbäddningskod</FieldLabel>
                <Textarea
                  id={`${id}-embed`}
                  value={embedInput}
                  rows={2}
                  onChange={(event) => setEmbedInput(event.currentTarget.value)}
                />
                <FieldDescription>
                  Från Artportalen, eller Google Maps: Dela → Bädda in en karta → Kopiera HTML.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-embed-title`}>Vad visar den?</FieldLabel>
                <Input
                  id={`${id}-embed-title`}
                  value={embedTitle}
                  onChange={(event) => setEmbedTitle(event.currentTarget.value)}
                />
              </Field>
            </FieldGroup>
            <div>
              <Button type="button" size="sm" onClick={applyEmbed}>
                Bädda in
              </Button>
            </div>
          </div>
        )}

        {!sourceView && panel === "image" && (
          <div className="border-b p-3">
            <ImageUpload
              supabaseUrl={supabaseUrl}
              supabasePublishableKey={supabasePublishableKey}
              onUploaded={(image) => {
                // After the selection, so an image never replaces selected text.
                run((c) =>
                  c.insertContentAt(editor.state.selection.to, {
                    type: "image",
                    attrs: {
                      src: mediaFallbackUrl(image),
                      srcset: mediaSrcset(image),
                      sizes: COLUMN_SIZES,
                      width: image.width,
                      height: image.height,
                      alt: image.alt,
                    },
                  })
                )
                setPanel(null)
              }}
              onCancel={() => setPanel(null)}
            />
          </div>
        )}

        {message && (
          <div className="border-b p-3">
            <Alert variant="destructive">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          </div>
        )}

        {sourceView ? (
          <div className="flex flex-col gap-2 p-3">
            <Textarea
              aria-label={`${label}, HTML`}
              value={html}
              spellCheck={false}
              onChange={(event) => setHtml(event.currentTarget.value)}
              className="min-h-80 font-mono text-sm"
            />
            <p className="text-muted-foreground text-sm">
              HTML som editorn inte stöder, till exempel färger, egna klasser eller skript, tas bort
              när du växlar tillbaka och när du sparar.
            </p>
          </div>
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </div>
  )
}
