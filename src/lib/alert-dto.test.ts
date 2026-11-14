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

const HYLTE = {
  id: 4242,
  slug: "hylte-mosse",
  name: "Hylte mosse",
  latitude: 56.46,
  longitude: 13.6,
  description: "LEAK-description",
}

/** What `alert-place.ts` decides for the row below; the DTO copies, never derives. */
const near = (label: string, lokal: typeof HYLTE | null = HYLTE) => ({
  label,
  lokal,
  position: { latitude: 56.46123, longitude: 13.59877 },
})
const nowhere = (label: string) => ({ label, lokal: null, position: null })

/** Every value that must never be published carries a searchable sentinel. */
const row: AlertRow = {
  id: ID,
  count: 3,
  observed_at: "2026-09-19T05:12:00+00:00",
  sent_at: "2026-09-19T05:14:11.401+00:00",
  observer_user_id: "LEAK-user-id",
  latitude: 56.4612345,
  longitude: 13.5987654,
  location_id: 4242,
  location_name: "Hylte mosse",
  species_id: 42,
  species: { swedish_name: "Kungsörn", scientific_name: "Aquila chrysaetos", rarity: 1 },
  observation: { image_path: "LEAK-image-path/observations/abc.jpg" },
}

describe("toPublicAlert", () => {
  it("publishes exactly the pinned fields, and no others", () => {
    const dto = toPublicAlert(row, near("Nära Hylte mosse"), "Anna Andersson")
    expect(Object.keys(dto).sort()).toEqual([...PUBLIC_ALERT_FIELDS])
  })

  it("carries no forbidden value, however it is nested or spread", () => {
    const serialized = JSON.stringify(
      toPublicAlert(row, near("Nära Hylte mosse"), "Anna Andersson")
    )
    // 4242 is `location_id`: read so a lokal page can group larm, never
    // published. The row's own seven-decimal coordinate never survives either:
    // the position published is the place module's, rounded.
    for (const sentinel of [
      "LEAK-user-id",
      "LEAK-image-path",
      "56.4612345",
      "13.5987654",
      "4242",
    ]) {
      expect(serialized, sentinel).not.toContain(sentinel)
    }
  })

  it("publishes the position only under `position`, and only as the place module gave it", () => {
    const dto = toPublicAlert(row, near("Nära Hylte mosse"), null)
    expect(dto.position).toEqual({ latitude: 56.46123, longitude: 13.59877 })
    // Withheld by the place module (a protected species): the row's coordinate
    // is still sitting there, and the DTO must not reach for it.
    const withheld = toPublicAlert(row, nowhere("Markaryds kommun"), null)
    expect(withheld.position).toBeNull()
    expect(JSON.stringify(withheld)).not.toMatch(/56\.46|13\.59/)
  })

  it("copies only the lokal's address, name and position, never its id or text", () => {
    const dto = toPublicAlert(row, near("Nära Hylte mosse"), null)
    expect(dto.lokal).toEqual({
      slug: "hylte-mosse",
      name: "Hylte mosse",
      latitude: 56.46,
      longitude: 13.6,
    })
    expect(JSON.stringify(dto)).not.toContain("LEAK-description")
    expect(toPublicAlert(row, near("Markaryds kommun", null), null).lokal).toBeNull()
  })

  it("takes the place and the observer as given, never from the row", () => {
    // The row says Hylte mosse and a user id; the DTO says what the policy
    // modules decided. A future edit reaching back into the row is the bug
    // this asserts against.
    const dto = toPublicAlert(row, nowhere("Markaryds kommun"), null)
    expect(dto.place).toBe("Markaryds kommun")
    expect(dto.observer).toBeNull()
  })

  it("addresses the photo through the Worker, never the storage path", () => {
    expect(toPublicAlert(row, nowhere("x"), null).photoUrl).toBe(`/larm/bild/${ID}`)
  })

  it("has no photo when the observation is gone or never had one", () => {
    // 21 of the 238 live larm have lost their observation, and 70 more never
    // carried a picture.
    expect(toPublicAlert({ ...row, observation: null }, nowhere("x"), null).photoUrl).toBeNull()
    expect(
      toPublicAlert({ ...row, observation: { image_path: null } }, nowhere("x"), null).photoUrl
    ).toBeNull()
    expect(
      toPublicAlert({ ...row, observation: { image_path: "" } }, nowhere("x"), null).photoUrl
    ).toBeNull()
  })

  it("survives a species that has been deleted, rather than rendering blank", () => {
    const dto = toPublicAlert({ ...row, species: null }, nowhere("x"), null)
    expect(dto.species).toBe("Obestämd art")
    expect(dto.scientificName).toBe("")
    expect(dto.rarity).toBe(5)
  })

  it("normalises rarity to the club's scale, defaulting an unlisted species", () => {
    expect(toPublicAlert(row, nowhere("x"), null).rarity).toBe(1)
    const unlisted = { ...row, species: { ...row.species, rarity: null } } as AlertRow
    expect(toPublicAlert(unlisted, nowhere("x"), null).rarity).toBe(5)
  })

  it("falls back to the sent time if a larm ever arrives without an observed one", () => {
    expect(toPublicAlert({ ...row, observed_at: null }, nowhere("x"), null).observedAt).toBe(
      row.sent_at
    )
  })
})

describe("the selects", () => {
  it("asks PostgREST for exactly these columns", () => {
    // Character for character on purpose: adding a column fails here first,
    // where a reviewer has to decide whether it may be published.
    expect(ALERT_SELECT).toBe(
      "id, count, observed_at, sent_at, observer_user_id, latitude, longitude, location_id, location_name, species_id, species:species(swedish_name, scientific_name, rarity), observation:observations(image_path)"
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
      "location_id",
      "location_name",
      "species_id",
      "image_path",
    ]) {
      expect(ALERT_SELECT, column).toContain(column)
    }
  })
})
