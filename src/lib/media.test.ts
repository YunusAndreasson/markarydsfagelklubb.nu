import { describe, expect, it } from "vitest"

import {
  isSiteMediaUrl,
  type MediaImage,
  mediaFallbackUrl,
  mediaSrcset,
  newStoragePrefix,
  planImageWidths,
  SITE_MEDIA_PUBLIC_PREFIX,
} from "./media"

const prefix = "2026/09/11111111-1111-1111-1111-111111111111"

describe("planImageWidths", () => {
  it("makes all three widths from a large photo", () => {
    expect(planImageWidths(6000)).toEqual([480, 960, 1600])
    expect(planImageWidths(1600)).toEqual([480, 960, 1600])
  })

  it("never upscales, keeping a smaller original at its own width", () => {
    expect(planImageWidths(1280)).toEqual([480, 960, 1280])
    expect(planImageWidths(700)).toEqual([480, 700])
    expect(planImageWidths(300)).toEqual([300])
  })

  it("gives nothing for a broken width", () => {
    expect(planImageWidths(0)).toEqual([])
    expect(planImageWidths(Number.NaN)).toEqual([])
  })
})

describe("URLs", () => {
  const image: MediaImage = {
    storage_prefix: prefix,
    format: "jpeg",
    widths: [960, 480],
    width: 960,
    height: 640,
    alt: "Strömstare",
  }

  it("builds the srcset from the stored widths, smallest first, with the format's extension", () => {
    expect(mediaSrcset(image)).toBe(
      `${SITE_MEDIA_PUBLIC_PREFIX}${prefix}/480.jpg 480w, ${SITE_MEDIA_PUBLIC_PREFIX}${prefix}/960.jpg 960w`
    )
    expect(mediaFallbackUrl(image)).toBe(`${SITE_MEDIA_PUBLIC_PREFIX}${prefix}/960.jpg`)
  })

  it("puts new uploads under year and month", () => {
    expect(newStoragePrefix(new Date("2026-09-19T23:30:00Z"), "abc")).toBe("2026/09/abc")
  })
})

describe("isSiteMediaUrl", () => {
  it("accepts the bucket and nothing that only looks like it", () => {
    expect(isSiteMediaUrl(`${SITE_MEDIA_PUBLIC_PREFIX}${prefix}/480.webp`)).toBe(true)
    expect(isSiteMediaUrl(`${SITE_MEDIA_PUBLIC_PREFIX}../user-uploads/x.jpg`)).toBe(false)
    expect(isSiteMediaUrl(`${SITE_MEDIA_PUBLIC_PREFIX}%2e%2e/user-uploads/x.jpg`)).toBe(false)
    expect(
      isSiteMediaUrl(
        "https://zgnmajovyqibgxlcomvb.supabase.co/storage/v1/object/public/user-uploads/x.jpg"
      )
    ).toBe(false)
    expect(isSiteMediaUrl("https://evil.example/storage/v1/object/public/site-media/x.webp")).toBe(
      false
    )
  })
})
