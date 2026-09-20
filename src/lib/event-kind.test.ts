import { describe, expect, it } from "vitest"

import {
  DEFAULT_EVENT_KIND,
  EVENT_KIND_LABELS,
  EVENT_KINDS,
  isEventKind,
  publicEventKindLabel,
} from "./event-kind"

describe("event kinds", () => {
  it("labels every value, and nothing else", () => {
    expect(Object.keys(EVENT_KIND_LABELS)).toEqual([...EVENT_KINDS])
  })

  it("uses values the slug and column checks both accept", () => {
    for (const kind of EVENT_KINDS) {
      expect(kind, kind).toMatch(/^[a-z]+$/)
    }
  })
})

describe("isEventKind", () => {
  it("accepts the list and rejects everything else", () => {
    expect(isEventKind("exkursion")).toBe(true)
    for (const bad of ["", "Exkursion", "möte", "utflykt", null, 3]) {
      expect(isEventKind(bad), String(bad)).toBe(false)
    }
  })
})

describe("publicEventKindLabel", () => {
  it("gives the Swedish word", () => {
    expect(publicEventKindLabel("exkursion")).toBe("Exkursion")
    expect(publicEventKindLabel("tavling")).toBe("Tävling")
  })

  it("says nothing for the default, which carries no information", () => {
    expect(publicEventKindLabel(DEFAULT_EVENT_KIND)).toBeNull()
  })

  it("says nothing for a value it doesn't know, rather than printing it raw", () => {
    expect(publicEventKindLabel("utflykt")).toBeNull()
  })
})
