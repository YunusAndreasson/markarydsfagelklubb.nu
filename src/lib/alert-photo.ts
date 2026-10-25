/**
 * The sizes a larm photo is served in (docs/roadmap.md, decision log,
 * 2026-10-24).
 *
 * Member uploads are full-size phone photos, about 0.5 MB and sometimes 3 MB,
 * with no smaller copies, and the app's bucket isn't ours to write to. So the
 * photo route asks Supabase Storage to resize on the way out. Storage bills per
 * distinct source image a month, not per size, so the number of variants costs
 * nothing extra; the table is fixed anyway, so a URL can't ask for arbitrary
 * work, and every page that shows a photo names one of these.
 */

export type PhotoTransform = {
  width: number
  /** With a height, Storage crops to fill the box (`resize=cover`). */
  height?: number
}

const VARIANTS = {
  /** Width only, the photo's own shape: every page that shows a larm photo. */
  "480": { width: 480 },
  "960": { width: 960 },
  "1600": { width: 1600 },
} as const satisfies Record<string, PhotoTransform>

export type PhotoVariant = keyof typeof VARIANTS

export type PhotoRequest =
  | { kind: "original" }
  | { kind: "variant"; transform: PhotoTransform }
  | { kind: "unknown" }

/**
 * `?v=` on the photo route. Matched as an exact key, never parsed as a number
 * (`Number("0x1E0")` is 480), and never off the prototype (`?v=constructor`).
 */
export function parsePhotoVariant(param: string | null): PhotoRequest {
  if (param === null) return { kind: "original" }
  if (!Object.hasOwn(VARIANTS, param)) return { kind: "unknown" }
  return { kind: "variant", transform: VARIANTS[param as PhotoVariant] }
}

export function alertPhotoSrc(photoUrl: string, variant: PhotoVariant): string {
  return `${photoUrl}?v=${variant}`
}

const SETS = {
  /** The /larm feed's column and the rail's 3:2 prints, cropped by CSS. */
  feed: ["480", "960"],
  /** A larm's own page, shown whole at up to 45rem. */
  detail: ["960", "1600"],
} as const satisfies Record<string, readonly PhotoVariant[]>

export function alertPhotoSrcset(photoUrl: string, set: keyof typeof SETS): string {
  return SETS[set]
    .map((variant) => `${alertPhotoSrc(photoUrl, variant)} ${VARIANTS[variant].width}w`)
    .join(", ")
}
