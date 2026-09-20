import { describe, expect, it } from "vitest"

import {
  ALERT_SELECT,
  type AlertRow,
  FORBIDDEN_COLUMNS,
  PROFILE_SELECT,
  PUBLIC_ALERT_FIELDS,
  toPublicAlert,
} from "./alert-dto"

const ID = "1f1c0f3a-9d1e-4a6b-9a8e-0c2c5b1a7f42"

/** Every value that must never be published carries a searchable sentinel. */
const row: AlertRow = {
  id: ID,
  count: 3,
  observed_at: "2026-09-19T05:12:00+00:00",
  sent_at: "2026-09-19T05:14:11.401+00:00",
  observer_user_id: "LEAK-user-id",
  latitude: 56.4612345,
  longitude: 13.5987654,
  location_name: "Hylte mosse",
  species_id: 42,
  species: { swedish_name: "Kungsörn", scientific_name: "Aquila chrysaetos", rarity: 1 },
  observation: { image_path: "LEAK-image-path/observations/abc.jpg" },
}

describe("toPublicAlert", () => {
  it("publishes exactly the pinned fields, and no others", () => {
    const dto = toPublicAlert(row, "Nära Hylte mosse", "Anna Andersson")
    expect(Object.keys(dto).sort()).toEqual([...PUBLIC_ALERT_FIELDS])
  })

  it("carries no forbidden value, however it is nested or spread", () => {
    const serialized = JSON.stringify(toPublicAlert(row, "Nära Hylte mosse", "Anna Andersson"))
    for (const sentinel of ["LEAK-user-id", "LEAK-image-path", "56.46", "13.59"]) {
      expect(serialized, sentinel).not.toContain(sentinel)
    }
  })

  it("takes the place and the observer as given, never from the row", () => {
    // The row says Hylte mosse and a user id; the DTO says what the policy
    // modules decided. A future edit reaching back into the row is the bug
    // this asserts against.
    const dto = toPublicAlert(row, "Markaryds kommun", null)
    expect(dto.place).toBe("Markaryds kommun")
    expect(dto.observer).toBeNull()
  })

  it("addresses the photo through the Worker, never the storage path", () => {
    expect(toPublicAlert(row, "x", null).photoUrl).toBe(`/larm/bild/${ID}`)
  })

  it("has no photo when the observation is gone or never had one", () => {
    // 21 of the 238 live larm have lost their observation, and 70 more never
    // carried a picture.
    expect(toPublicAlert({ ...row, observation: null }, "x", null).photoUrl).toBeNull()
    expect(
      toPublicAlert({ ...row, observation: { image_path: null } }, "x", null).photoUrl
    ).toBeNull()
    expect(
      toPublicAlert({ ...row, observation: { image_path: "" } }, "x", null).photoUrl
    ).toBeNull()
  })

  it("survives a species that has been deleted, rather than rendering blank", () => {
    const dto = toPublicAlert({ ...row, species: null }, "x", null)
    expect(dto.species).toBe("Obestämd art")
    expect(dto.scientificName).toBe("")
    expect(dto.rarity).toBe(5)
  })

  it("normalises rarity to the club's scale, defaulting an unlisted species", () => {
    expect(toPublicAlert(row, "x", null).rarity).toBe(1)
    const unlisted = { ...row, species: { ...row.species, rarity: null } } as AlertRow
    expect(toPublicAlert(unlisted, "x", null).rarity).toBe(5)
  })

  it("falls back to the sent time if a larm ever arrives without an observed one", () => {
    expect(toPublicAlert({ ...row, observed_at: null }, "x", null).observedAt).toBe(row.sent_at)
  })
})

describe("the selects", () => {
  it("asks PostgREST for exactly these columns", () => {
    // Character for character on purpose: adding a column fails here first,
    // where a reviewer has to decide whether it may be published.
    expect(ALERT_SELECT).toBe(
      "id, count, observed_at, sent_at, observer_user_id, latitude, longitude, location_name, species_id, species:species(swedish_name, scientific_name, rarity), observation:observations(image_path)"
    )
    expect(PROFILE_SELECT).toBe("user_id, display_name")
  })

  it("asks for no column that must never leave the database", () => {
    const tokens = `${ALERT_SELECT} ${PROFILE_SELECT}`.match(/[a-z_]+/g) ?? []
    for (const forbidden of FORBIDDEN_COLUMNS) {
      // `profiles.user_id` is the join key and is allowed there; nowhere else.
      if (forbidden === "user_id") continue
      expect(tokens, forbidden).not.toContain(forbidden)
    }
  })

  it("never reads alerts.observer_name, which outlives a deleted account", () => {
    expect(ALERT_SELECT).not.toContain("observer_name")
  })

  it("reads every column the DTO and the policy modules need", () => {
    for (const column of [
      "id",
      "count",
      "observed_at",
      "sent_at",
      "latitude",
      "longitude",
      "location_name",
      "species_id",
      "image_path",
    ]) {
      expect(ALERT_SELECT, column).toContain(column)
    }
  })
})
