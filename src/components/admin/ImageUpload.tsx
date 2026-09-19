import { useId, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  type MediaFormat,
  type MediaImage,
  mediaObjectPath,
  newStoragePrefix,
  SITE_MEDIA_BUCKET,
} from "@/lib/media"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { ACCEPTED_TYPES, ImagePrepareError, prepareImage } from "./image-variants"

export type UploadedImage = MediaImage & { id: number }

type Props = {
  supabaseUrl: string
  supabasePublishableKey: string
  onUploaded: (image: UploadedImage) => void
  onCancel?: () => void
}

const CONTENT_TYPE: Record<MediaFormat, string> = { webp: "image/webp", jpeg: "image/jpeg" }

/**
 * Pick a photo, describe it, upload it. The variants go straight from the
 * browser to the site-media bucket with the admin's own session; storage RLS
 * lets only the administrator write there.
 *
 * Deliberately not a <form>: it sits inside the article form, and forms can't
 * nest. Its buttons are type="button".
 */
export function ImageUpload({ supabaseUrl, supabasePublishableKey, onUploaded, onCancel }: Props) {
  const id = useId()
  const [file, setFile] = useState<File | null>(null)
  const [alt, setAlt] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = status !== null

  async function upload() {
    if (!file || !alt.trim()) return
    setError(null)
    const supabase = getSupabaseBrowserClient(supabaseUrl, supabasePublishableKey)
    const uploadedPaths: string[] = []

    try {
      setStatus("Förbereder bilden …")
      const prepared = await prepareImage(file)
      const prefix = newStoragePrefix(new Date(), crypto.randomUUID())

      for (const [index, variant] of prepared.variants.entries()) {
        setStatus(`Laddar upp ${index + 1} av ${prepared.variants.length} …`)
        const path = mediaObjectPath(prefix, variant.width, prepared.format)
        const { error: uploadError } = await supabase.storage
          .from(SITE_MEDIA_BUCKET)
          .upload(path, variant.blob, {
            contentType: CONTENT_TYPE[prepared.format],
            // The path is new for every upload, so the file never changes.
            cacheControl: "31536000",
            upsert: false,
          })
        if (uploadError) throw uploadError
        uploadedPaths.push(path)
      }

      const { data, error: insertError } = await supabase
        .from("media")
        .insert({
          storage_prefix: prefix,
          format: prepared.format,
          widths: prepared.variants.map((variant) => variant.width),
          width: prepared.width,
          height: prepared.height,
          alt: alt.trim(),
          bytes: prepared.bytes,
        })
        .select("id, storage_prefix, format, widths, width, height, alt")
        .single()
      if (insertError) throw insertError

      setFile(null)
      setAlt("")
      onUploaded({ ...data, format: data.format as MediaFormat })
    } catch (caught) {
      // Leave nothing half-uploaded behind.
      if (uploadedPaths.length > 0) {
        await supabase.storage.from(SITE_MEDIA_BUCKET).remove(uploadedPaths)
      }
      console.error("mafk-web: image upload failed", caught)
      setError(
        caught instanceof ImagePrepareError
          ? caught.message
          : "Bilden kunde inte laddas upp. Kontrollera att du är inloggad och försök igen."
      )
    } finally {
      setStatus(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border p-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-file`}>Bild</FieldLabel>
          <Input
            id={`${id}-file`}
            type="file"
            accept={ACCEPTED_TYPES}
            disabled={busy}
            onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
          />
          <FieldDescription>
            JPEG, PNG eller WebP. Stora bilder förminskas automatiskt.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-alt`}>Vad visar bilden?</FieldLabel>
          <Input
            id={`${id}-alt`}
            value={alt}
            disabled={busy}
            onChange={(event) => setAlt(event.currentTarget.value)}
          />
          <FieldDescription>
            Läses upp för den som inte ser bilden. Till exempel: ”Strömstare på en sten i Lagan”.
          </FieldDescription>
        </Field>
      </FieldGroup>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={busy || !file || !alt.trim()}
          onClick={upload}
          className="h-11"
        >
          Ladda upp
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel} className="h-11">
            Avbryt
          </Button>
        )}
        {status && (
          <span role="status" className="text-muted-foreground text-sm">
            {status}
          </span>
        )}
      </div>
    </div>
  )
}
