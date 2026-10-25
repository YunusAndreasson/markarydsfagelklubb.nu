import { type MediaFormat, planImageWidths } from "@/lib/media"

/**
 * Turns a photo from the admin's disk into the site's variants, in the
 * browser, before anything is uploaded (docs/roadmap.md, D3).
 *
 * Re-encoding through a canvas also drops every byte of metadata, EXIF GPS
 * included, so a member's photo never publishes where it was taken.
 */

export type ImageVariant = { width: number; height: number; blob: Blob }

export type PreparedImage = {
  format: MediaFormat
  /** Of the largest variant. */
  width: number
  height: number
  variants: ImageVariant[]
  bytes: number
}

/** Anything bigger is almost certainly not a photo meant for the web. */
export const MAX_SOURCE_BYTES = 40 * 1024 * 1024

export const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp"

export class ImagePrepareError extends Error {}

/**
 * OffscreenCanvas everywhere the build targets reach (Safari 16.4 and up), so
 * there is no `<canvas>` and `toBlob` path to keep.
 */
function context(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new ImagePrepareError("Webbläsaren kan inte bearbeta bilder.")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  return ctx
}

/**
 * Safari can't encode WebP: asked for it, it quietly returns a PNG. Probe once
 * with a single pixel and fall back to JPEG for every variant.
 */
async function supportedFormat(): Promise<MediaFormat> {
  const probe = new OffscreenCanvas(1, 1)
  context(probe).fillRect(0, 0, 1, 1)
  const blob = await probe.convertToBlob({ type: "image/webp", quality: 0.8 })
  return blob.type === "image/webp" ? "webp" : "jpeg"
}

/**
 * Draws `source` at `width` × `height`, halving in steps on the way down.
 * One big jump from 6000 px to 480 px shimmers; halving keeps edges clean.
 */
function drawScaled(
  source: CanvasImageSource & { width: number; height: number },
  width: number,
  height: number,
  opaque: boolean
): OffscreenCanvas {
  let current: CanvasImageSource & { width: number; height: number } = source
  while (current.width / 2 >= width) {
    const half = new OffscreenCanvas(Math.round(current.width / 2), Math.round(current.height / 2))
    context(half).drawImage(current, 0, 0, half.width, half.height)
    current = half
  }
  const canvas = new OffscreenCanvas(width, height)
  const ctx = context(canvas)
  if (opaque) {
    // JPEG has no transparency: a transparent PNG would otherwise turn black.
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(current, 0, 0, width, height)
  return canvas
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new ImagePrepareError("Bilden är större än 40 MB. Välj en mindre bild.")
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    throw new ImagePrepareError(
      "Bilden kunde inte läsas. Spara den som JPEG eller PNG och försök igen."
    )
  }

  try {
    const widths = planImageWidths(bitmap.width)
    if (widths.length === 0) throw new ImagePrepareError("Bilden verkar vara tom.")
    const format = await supportedFormat()
    const variants: ImageVariant[] = []
    for (const width of widths) {
      const height = Math.max(1, Math.round((bitmap.height * width) / bitmap.width))
      const canvas = drawScaled(bitmap, width, height, format === "jpeg")
      const blob = await canvas.convertToBlob({
        type: format === "webp" ? "image/webp" : "image/jpeg",
        quality: 0.82,
      })
      variants.push({ width, height, blob })
    }
    const largest = variants.at(-1)
    return {
      format,
      width: largest?.width ?? bitmap.width,
      height: largest?.height ?? bitmap.height,
      variants,
      bytes: variants.reduce((total, variant) => total + variant.blob.size, 0),
    }
  } finally {
    bitmap.close()
  }
}
