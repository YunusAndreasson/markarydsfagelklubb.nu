import { describe, expect, it } from "vitest"

import {
  MESSAGES,
  parseArticleForm,
  parseCategoryForm,
  parseEventForm,
  parseLinkForm,
  parseLokalPointForm,
  parsePageForm,
  parseRouteId,
} from "./content-form"

function form(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

describe("parseArticleForm", () => {
  it("reads a complete article and makes the slug from the title", () => {
    const result = parseArticleForm(
      form({
        title: "  Sträckräkning på Skararps ängar ",
        slug: "",
        excerpt: "Tusentals bofinkar.",
        author_name: "Anna",
        category_id: "3",
        cover_media_id: "",
        body_html: "<p>Text</p>",
        publish_at: "2026-09-19T10:00",
      })
    )
    expect(result).toEqual({
      ok: true,
      value: {
        title: "Sträckräkning på Skararps ängar",
        slug: "strackrakning-pa-skararps-angar",
        excerpt: "Tusentals bofinkar.",
        author_name: "Anna",
        category_id: 3,
        cover_media_id: null,
        body_html: "<p>Text</p>",
        publish_at: new Date("2026-09-19T08:00:00Z"),
      },
    })
  })

  it("reports every problem at once, in Swedish", () => {
    const result = parseArticleForm(
      form({
        title: "",
        slug: "Inte OK",
        category_id: "abc",
        publish_at: "igår",
        excerpt: "x".repeat(401),
      })
    )
    expect(result).toEqual({
      ok: false,
      errors: {
        title: MESSAGES.titleMissing,
        slug: MESSAGES.slugInvalid,
        excerpt: MESSAGES.excerptTooLong,
        category_id: MESSAGES.choiceInvalid,
        publish_at: MESSAGES.publishAtInvalid,
      },
    })
  })

  it("keeps an article from taking the category route's name", () => {
    const result = parseArticleForm(form({ title: "Kategori" }))
    expect(result.ok).toBe(false)
    expect(!result.ok && result.errors.slug).toBe(MESSAGES.slugReserved("kategori"))
  })

  it("leaves the body and cover alone when their islands never loaded", () => {
    const result = parseArticleForm(form({ title: "Utan JavaScript" }))
    expect(result.ok && result.value.body_html).toBeNull()
    expect(result.ok && result.value.cover_media_id).toBeUndefined()
  })

  it("asks for a slug when the title gives none", () => {
    const result = parseArticleForm(form({ title: "???" }))
    expect(!result.ok && result.errors.slug).toBe(MESSAGES.slugMissing)
  })
})

describe("parsePageForm", () => {
  it("reserves the site's routes for top-level pages only", () => {
    const top = parsePageForm(form({ title: "Artiklar" }))
    expect(!top.ok && top.errors.slug).toBe(MESSAGES.slugReserved("artiklar"))
    const nested = parsePageForm(form({ title: "Artiklar", parent_id: "4" }))
    expect(nested.ok).toBe(true)
  })

  it("refuses the page itself or a descendant as parent", () => {
    const result = parsePageForm(form({ title: "Om", parent_id: "7" }), {
      forbiddenParentIds: new Set([5, 7]),
    })
    expect(!result.ok && result.errors.parent_id).toBe(MESSAGES.parentInvalid)
  })

  it("reads the menu checkbox the way browsers send it", () => {
    const shown = parsePageForm(form({ title: "Om", show_in_menu: "on" }))
    const hidden = parsePageForm(form({ title: "Om" }))
    expect(shown.ok && shown.value.show_in_menu).toBe(true)
    expect(hidden.ok && hidden.value.show_in_menu).toBe(false)
  })
})

describe("parseLinkForm", () => {
  it("accepts web, mail and on-site links", () => {
    for (const url of [
      "https://www.artportalen.se/",
      "http://example.se",
      "mailto:webmaster@markarydsfagelklubb.nu",
      "/artiklar",
      "/",
    ]) {
      expect(parseLinkForm(form({ title: "Länk", link_url: url })).ok, url).toBe(true)
    }
  })

  it("refuses script, data and protocol-relative links", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,x",
      "//evil.example/",
      "",
      "artportalen.se",
      "https://",
    ]) {
      const result = parseLinkForm(form({ title: "Länk", link_url: url }))
      expect(!result.ok && result.errors.link_url, url).toBe(MESSAGES.linkUrlInvalid)
    }
  })
})

describe("parseCategoryForm", () => {
  it("needs a name and makes the slug from it", () => {
    expect(parseCategoryForm(form({ name: "Föreningsaktuellt" }))).toEqual({
      ok: true,
      value: { name: "Föreningsaktuellt", slug: "foreningsaktuellt" },
    })
    expect(parseCategoryForm(form({ name: "" }))).toEqual({
      ok: false,
      errors: { name: MESSAGES.nameMissing },
    })
  })
})

describe("parseRouteId", () => {
  it("accepts positive integers only", () => {
    expect(parseRouteId("12")).toBe(12)
    for (const bad of [undefined, "", "0", "-1", "1.5", "12abc", "ny"]) {
      expect(parseRouteId(bad), String(bad)).toBeNull()
    }
  })
})

describe("parseEventForm", () => {
  const fields = {
    title: "Ugglespaning vid Hualtet",
    slug: "",
    summary: "Samling vid kyrkan.",
    place: "Ekebacken",
    kind: "exkursion",
    registration_url: "",
    starts_at: "2026-10-03T18:00",
    ends_at: "",
    body_html: "<p>Ta med kikare.</p>",
    publish_at: "2026-09-20T10:00",
  }

  it("reads a complete event and makes the slug from the title", () => {
    expect(parseEventForm(form(fields))).toEqual({
      ok: true,
      value: {
        title: "Ugglespaning vid Hualtet",
        slug: "ugglespaning-vid-hualtet",
        summary: "Samling vid kyrkan.",
        place: "Ekebacken",
        kind: "exkursion",
        registration_url: null,
        contact_name: "",
        contact_phone: "",
        signup_deadline: null,
        starts_at: new Date("2026-10-03T16:00:00Z"),
        ends_at: null,
        all_day: false,
        body_html: "<p>Ta med kikare.</p>",
        publish_at: new Date("2026-09-20T08:00:00Z"),
      },
    })
  })

  it("falls back to the neutral kind when none was chosen", () => {
    const result = parseEventForm(form({ ...fields, kind: "" }))
    expect(result.ok && result.value.kind).toBe("ovrigt")
  })

  it("rejects a kind that isn't in the list", () => {
    const result = parseEventForm(form({ ...fields, kind: "utflykt" }))
    expect(!result.ok && result.errors.kind).toBe(MESSAGES.choiceInvalid)
  })

  it("moves an all-day event to midnight, Swedish time", () => {
    const result = parseEventForm(
      form({ ...fields, all_day: "on", starts_at: "2026-10-03T18:00", ends_at: "2026-10-05T09:00" })
    )
    expect(result.ok && result.value.starts_at.toISOString()).toBe("2026-10-02T22:00:00.000Z")
    expect(result.ok && result.value.ends_at?.toISOString()).toBe("2026-10-04T22:00:00.000Z")
    expect(result.ok && result.value.all_day).toBe(true)
  })

  it("keeps an all-day event that starts and ends the same day", () => {
    const result = parseEventForm(
      form({ ...fields, all_day: "on", starts_at: "2026-10-03T18:00", ends_at: "2026-10-03T09:00" })
    )
    expect(result.ok).toBe(true)
  })

  it("insists on a start time", () => {
    const result = parseEventForm(form({ ...fields, starts_at: "" }))
    expect(!result.ok && result.errors.starts_at).toBe(MESSAGES.startMissing)
  })

  it("refuses an end before the start", () => {
    const result = parseEventForm(form({ ...fields, ends_at: "2026-10-03T17:00" }))
    expect(!result.ok && result.errors.ends_at).toBe(MESSAGES.endBeforeStart)
  })

  it("refuses an address shaped like a month page", () => {
    const result = parseEventForm(form({ ...fields, slug: "2026-10" }))
    expect(!result.ok && result.errors.slug).toBe(MESSAGES.slugMonthShape)
  })

  it("accepts an address that only looks like one", () => {
    const result = parseEventForm(form({ ...fields, slug: "2026-13" }))
    expect(result.ok && result.value.slug).toBe("2026-13")
  })

  it("reads who to call and by when", () => {
    const result = parseEventForm(
      form({
        ...fields,
        contact_name: "Anna Svensson",
        contact_phone: "0705 – 12 34 56",
        signup_deadline: "2026-09-30",
      })
    )
    expect(result.ok && result.value.contact_phone).toBe("0705 – 12 34 56")
    expect(result.ok && result.value.signup_deadline).toBe("2026-09-30")
  })

  it("refuses a phone number or a last day that isn't one", () => {
    const result = parseEventForm(
      form({ ...fields, contact_phone: "ring mig", signup_deadline: "2026-13-40" })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.contact_phone).toBe(MESSAGES.contactPhoneInvalid)
      expect(result.errors.signup_deadline).toBe(MESSAGES.deadlineInvalid)
    }
  })

  it("checks the registration link the same way as a menu link", () => {
    expect(parseEventForm(form({ ...fields, registration_url: "javascript:alert(1)" })).ok).toBe(
      false
    )
    const mail = parseEventForm(form({ ...fields, registration_url: "mailto:a@b.se" }))
    expect(mail.ok && mail.value.registration_url).toBe("mailto:a@b.se")
  })

  it("reports every problem at once, in Swedish", () => {
    const result = parseEventForm(
      form({
        title: "",
        slug: "Inte En Slug",
        summary: "x".repeat(401),
        place: "y".repeat(121),
        kind: "utflykt",
        registration_url: "nej",
        starts_at: "igår",
        ends_at: "imorgon",
        publish_at: "snart",
      })
    )
    expect(result).toEqual({
      ok: false,
      errors: {
        title: MESSAGES.titleMissing,
        slug: MESSAGES.slugInvalid,
        summary: MESSAGES.excerptTooLong,
        place: MESSAGES.placeTooLong,
        kind: MESSAGES.choiceInvalid,
        registration_url: MESSAGES.linkUrlInvalid,
        starts_at: MESSAGES.startInvalid,
        ends_at: MESSAGES.endInvalid,
        publish_at: MESSAGES.publishAtInvalid,
      },
    })
  })

  it("leaves the description alone when the editor never loaded", () => {
    const data = form(fields)
    data.delete("body_html")
    const result = parseEventForm(data)
    expect(result.ok && result.value.body_html).toBeNull()
  })
})

describe("parseLokalPointForm", () => {
  it("reads a place, with a Swedish decimal comma", () => {
    const result = parseLokalPointForm(
      form({
        name: "Röda ladan",
        note: "Samlingsplats.",
        kind: "practical",
        latitude: "56,6483",
        longitude: "13.7637",
        sort_order: "10",
      })
    )
    expect(result).toEqual({
      ok: true,
      value: {
        name: "Röda ladan",
        note: "Samlingsplats.",
        kind: "practical",
        latitude: 56.6483,
        longitude: 13.7637,
        sort_order: 10,
      },
    })
  })

  it("takes a place with no position", () => {
    const result = parseLokalPointForm(form({ name: "Hitta hit", latitude: "", longitude: "" }))
    expect(result.ok && result.value.latitude).toBeNull()
  })

  it("wants both coordinates or neither, and real ones", () => {
    expect(parseLokalPointForm(form({ name: "A", latitude: "56.5", longitude: "" })).ok).toBe(false)
    expect(parseLokalPointForm(form({ name: "A", latitude: "fel", longitude: "13.5" })).ok).toBe(
      false
    )
    expect(parseLokalPointForm(form({ name: "A", latitude: "95", longitude: "13.5" })).ok).toBe(
      false
    )
  })

  it("wants a name", () => {
    expect(parseLokalPointForm(form({ name: "" })).ok).toBe(false)
  })
})
