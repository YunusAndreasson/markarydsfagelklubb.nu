import { describe, expect, it } from "vitest"

import {
  addressMailto,
  addressMessage,
  addressSms,
  MEMBERSHIP_MESSAGES,
  parseMembershipForm,
  swishLink,
  swishMessage,
  swishPayee,
  telHref,
} from "./membership"

describe("swishPayee", () => {
  it("reads the ten digits however they are grouped", () => {
    expect(swishPayee("123 267 61 61")).toBe("1232676161")
    expect(swishPayee("123-2676161")).toBe("1232676161")
  })
  it("refuses anything that isn't ten digits", () => {
    expect(swishPayee("")).toBeNull()
    expect(swishPayee("123 267 61")).toBeNull()
    expect(swishPayee("123 267 61 61 1")).toBeNull()
  })
})

describe("swishMessage", () => {
  it("puts the name first, and works without one", () => {
    expect(swishMessage(2027, "Anna Svensson")).toBe("Anna Svensson medlem 2027")
    expect(swishMessage(2027)).toBe("medlem 2027")
    expect(swishMessage(2027, "  ")).toBe("medlem 2027")
  })
})

describe("swishLink", () => {
  it("fills in number, amount and message, leaving the message open for the name", () => {
    expect(swishLink("123 267 61 61", { year: 2027, amount: 100 })).toBe(
      "https://app.swish.nu/1/p/sw/?sw=1232676161&amt=100&cur=SEK&msg=medlem%202027&edit=msg&src=qr"
    )
  })
  it("leaves the amount open when there isn't one, for the one QR code", () => {
    expect(swishLink("1232676161", { year: 2027 })).toBe(
      "https://app.swish.nu/1/p/sw/?sw=1232676161&msg=medlem%202027&edit=amt,msg&src=qr"
    )
  })
  it("gives nothing without a valid number", () => {
    expect(swishLink("", { year: 2027, amount: 100 })).toBeNull()
  })
})

describe("telHref", () => {
  it("turns a Swedish number into international form", () => {
    expect(telHref("070-174 06 50")).toBe("tel:+46701740650")
    expect(telHref("+46 70 174 06 50")).toBe("tel:+46701740650")
    expect(telHref("0046701740650")).toBe("tel:+46701740650")
  })
  it("gives nothing for something too short or without a country", () => {
    expect(telHref("12 34")).toBeNull()
    expect(telHref("701740650")).toBeNull()
    expect(telHref("")).toBeNull()
  })
})

describe("address links", () => {
  it("prefills the same text by email and by SMS", () => {
    const text = addressMessage(2027)
    expect(text).toContain("medlemsavgiften för 2027")
    expect(text).toContain("Adress:")
    expect(addressMailto("kassor@example.se", 2027)).toBe(
      `mailto:kassor@example.se?subject=Ny%20medlem%202027&body=${encodeURIComponent(text)}`
    )
    expect(addressSms("070-174 06 50", 2027)).toBe(
      `sms:+46701740650?&body=${encodeURIComponent(text)}`
    )
  })
  it("has no SMS link without a usable number", () => {
    expect(addressSms("", 2027)).toBeNull()
  })
})

describe("parseMembershipForm", () => {
  const form = (fields: Record<string, string>) => {
    const data = new FormData()
    for (const [name, value] of Object.entries(fields)) data.set(name, value)
    return data
  }
  const valid = {
    year: "2027",
    fee_adult: "100",
    fee_youth: "40",
    fee_family: "40 kr",
    youth_max_age: "20",
    swish: "123  267 61 61",
    bankgiro: "5661-4969",
    contact_name: " Karin Berg ",
    contact_email: "kassor@markarydsfagelklubb.nu",
    contact_phone: "070-174 06 50",
  }

  it("reads a filled-in form, tidying whitespace and a trailing kr", () => {
    expect(parseMembershipForm(form(valid))).toEqual({
      ok: true,
      value: {
        year: 2027,
        fee_adult: 100,
        fee_youth: 40,
        fee_family: 40,
        youth_max_age: 20,
        swish: "123 267 61 61",
        bankgiro: "5661-4969",
        contact_name: "Karin Berg",
        contact_email: "kassor@markarydsfagelklubb.nu",
        contact_phone: "070-174 06 50",
      },
    })
  })

  it("allows Swish and bankgiro to be empty", () => {
    const parsed = parseMembershipForm(form({ ...valid, swish: "", bankgiro: "" }))
    expect(parsed.ok).toBe(true)
  })

  it("names each field that is wrong, in the admin's words", () => {
    const parsed = parseMembershipForm(
      form({
        ...valid,
        year: "27",
        fee_adult: "100,50",
        fee_youth: "-40",
        youth_max_age: "0",
        swish: "123 267",
        bankgiro: "56614969",
        contact_email: "kassor",
        contact_phone: "ring mig",
      })
    )
    expect(parsed).toEqual({
      ok: false,
      errors: {
        year: MEMBERSHIP_MESSAGES.year,
        fee_adult: MEMBERSHIP_MESSAGES.fee,
        fee_youth: MEMBERSHIP_MESSAGES.fee,
        youth_max_age: MEMBERSHIP_MESSAGES.youthAge,
        swish: MEMBERSHIP_MESSAGES.swish,
        bankgiro: MEMBERSHIP_MESSAGES.bankgiro,
        contact_email: MEMBERSHIP_MESSAGES.email,
        contact_phone: MEMBERSHIP_MESSAGES.phone,
      },
    })
  })

  it("needs some way for a new member to send their address", () => {
    const parsed = parseMembershipForm(form({ ...valid, contact_email: "", contact_phone: "" }))
    expect(parsed).toEqual({
      ok: false,
      errors: { contact_email: MEMBERSHIP_MESSAGES.contactMissing },
    })
  })

  it("keeps out what would break a mailto: link", () => {
    const parsed = parseMembershipForm(form({ ...valid, contact_email: 'a@b.se"onclick=x' }))
    expect(parsed.ok).toBe(false)
  })
})
