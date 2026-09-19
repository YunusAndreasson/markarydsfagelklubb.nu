import { describe, expect, it } from "vitest"

import { parsePublishIntent, publishStateOf, resolvePublication } from "./publish-state"

const now = new Date("2026-09-19T12:00:00Z")
const earlier = "2026-09-01T08:00:00.000Z"
const later = "2026-10-01T08:00:00.000Z"

describe("publishStateOf", () => {
  it("derives scheduled from a published row that isn't due yet", () => {
    expect(publishStateOf({ status: "draft", published_at: null }, now)).toBe("draft")
    expect(publishStateOf({ status: "draft", published_at: earlier }, now)).toBe("draft")
    expect(publishStateOf({ status: "published", published_at: earlier }, now)).toBe("published")
    expect(publishStateOf({ status: "published", published_at: later }, now)).toBe("scheduled")
  })
})

describe("resolvePublication", () => {
  it("publishes now, or at the time typed in", () => {
    expect(resolvePublication("publish", null, null, now)).toEqual({
      status: "published",
      published_at: now.toISOString(),
    })
    expect(resolvePublication("publish", null, new Date(later), now)).toEqual({
      status: "published",
      published_at: later,
    })
  })

  it("saves a draft as a draft, remembering a typed time", () => {
    expect(resolvePublication("save", null, null, now)).toEqual({
      status: "draft",
      published_at: null,
    })
    expect(
      resolvePublication("save", { status: "draft", published_at: null }, new Date(later), now)
    ).toEqual({
      status: "draft",
      published_at: later,
    })
  })

  it("keeps a published article published, and its date, when it is only saved", () => {
    expect(
      resolvePublication("save", { status: "published", published_at: earlier }, null, now)
    ).toEqual({
      status: "published",
      published_at: earlier,
    })
  })

  it("unpublishes to a draft that keeps its date", () => {
    expect(
      resolvePublication("unpublish", { status: "published", published_at: earlier }, null, now)
    ).toEqual({
      status: "draft",
      published_at: earlier,
    })
  })
})

describe("parsePublishIntent", () => {
  it("accepts only the form's buttons", () => {
    expect(parsePublishIntent("publish")).toBe("publish")
    expect(parsePublishIntent("delete")).toBeNull()
    expect(parsePublishIntent(null)).toBeNull()
  })
})
