import { useState } from "react"
import { Button } from "@/components/ui/button"
import { mediaUrl } from "@/lib/media"
import { ImageUpload, type UploadedImage } from "./ImageUpload"

type Props = {
  supabaseUrl: string
  supabasePublishableKey: string
  initial: UploadedImage | null
  /** The form field that carries the chosen media id. */
  name?: string
}

/**
 * The article's cover photo. Choosing or removing one only changes the form;
 * nothing is saved until the article is. Removing it here keeps the file,
 * which may be used elsewhere; files are deleted under Bilder.
 */
export function CoverImage({
  supabaseUrl,
  supabasePublishableKey,
  initial,
  name = "cover_media_id",
}: Props) {
  const [cover, setCover] = useState<UploadedImage | null>(initial)
  const [picking, setPicking] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={cover?.id ?? ""} />

      {cover && !picking && (
        <figure className="flex flex-col gap-2">
          <img
            src={mediaUrl(cover.storage_prefix, Math.min(...cover.widths), cover.format)}
            alt={cover.alt}
            width={cover.width}
            height={cover.height}
            className="h-auto w-full max-w-xs rounded-lg"
          />
          <figcaption className="text-muted-foreground text-sm">{cover.alt}</figcaption>
        </figure>
      )}

      {picking ? (
        <ImageUpload
          supabaseUrl={supabaseUrl}
          supabasePublishableKey={supabasePublishableKey}
          onUploaded={(image) => {
            setCover(image)
            setPicking(false)
          }}
          onCancel={() => setPicking(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-11" onClick={() => setPicking(true)}>
            {cover ? "Byt bild" : "Lägg till omslagsbild"}
          </Button>
          {cover && (
            <Button type="button" variant="ghost" className="h-11" onClick={() => setCover(null)}>
              Ta bort omslagsbild
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
