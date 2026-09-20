import { describe, expect, it } from "vitest"

import { ANONYMOUS_OBSERVER, observerIndex, observerName, type ProfileName } from "./alert-observer"

const profiles: ProfileName[] = [
  { user_id: "u-anna", display_name: "Anna Andersson" },
  { user_id: "u-blank", display_name: "   " },
  { user_id: "u-null", display_name: null },
]

const index = observerIndex(profiles)

describe("observerIndex", () => {
  it("keeps the names that can actually be printed", () => {
    expect(index.get("u-anna")).toBe("Anna Andersson")
    expect(index.size).toBe(1)
  })

  it("trims, so a padded name doesn't print with its whitespace", () => {
    expect(observerIndex([{ user_id: "u", display_name: "  Bo  " }]).get("u")).toBe("Bo")
  })
})

describe("observerName", () => {
  it("publishes the live display name from profiles", () => {
    expect(observerName("u-anna", index)).toBe("Anna Andersson")
  })

  it("publishes nobody once the account is gone", () => {
    // The whole point of this module: alerts.observer_name survives an account
    // deletion, so resolving through profiles is what lets a member leave.
    expect(observerName("u-deleted", index)).toBeNull()
  })

  it("publishes nobody when the profile has no usable name", () => {
    expect(observerName("u-blank", index)).toBeNull()
    expect(observerName("u-null", index)).toBeNull()
  })

  it("publishes nobody when the larm has no observer at all", () => {
    for (const missing of [null, undefined, ""]) {
      expect(observerName(missing, index), String(missing)).toBeNull()
    }
  })

  it("offers one wording for the anonymous case, so pages don't each invent one", () => {
    expect(ANONYMOUS_OBSERVER).toBe("En medlem")
  })
})
