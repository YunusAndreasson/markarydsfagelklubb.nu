import { describe, expect, it } from "vitest"

import { alertPhotoSrc, alertPhotoSrcset, parsePhotoVariant } from "./alert-photo"

describe("parsePhotoVariant", () => {
  it("serves the original when no size is asked for", () => {
    expect(parsePhotoVariant(null)).toEqual({ kind: "original" })
  })

  it("knows the fixed sizes, width-only and cropped", () => {
    expect(parsePhotoVariant("480")).toEqual({ kind: "variant", transform: { width: 480 } })
    expect(parsePhotoVariant("1600")).toEqual({ kind: "variant", transform: { width: 1600 } })
    expect(parsePhotoVariant("p960")).toEqual({
      kind: "variant",
      transform: { width: 960, height: 1200 },
    })
  })

  it("refuses anything else, including numbers that only look like a size", () => {
    for (const param of [
      "",
      "123",
      "0x1E0",
      "480.0",
      " 480",
      "4.8e2",
      "P480",
      "constructor",
      "__proto__",
      "toString",
    ]) {
      expect(parsePhotoVariant(param), param).toEqual({ kind: "unknown" })
    }
  })
})

describe("alertPhotoSrc and alertPhotoSrcset", () => {
  const url = "/larm/bild/0b9b6a52-1c1e-4c43-9d0a-4f5d2c1e9f10"

  it("names a size on the photo route", () => {
    expect(alertPhotoSrc(url, "p480")).toBe(`${url}?v=p480`)
  })

  it("describes each set by its real pixel width", () => {
    expect(alertPhotoSrcset(url, "feed")).toBe(`${url}?v=480 480w, ${url}?v=960 960w`)
    expect(alertPhotoSrcset(url, "print")).toBe(`${url}?v=p480 480w, ${url}?v=p960 960w`)
    expect(alertPhotoSrcset(url, "detail")).toBe(`${url}?v=960 960w, ${url}?v=1600 1600w`)
  })
})
