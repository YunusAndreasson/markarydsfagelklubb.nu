import type { FieldErrors, Parsed } from "./content-form"
import type { Database } from "./database.types"
import type { SupabasePublicClient } from "./supabase-public"

/**
 * What membership costs and how to pay (docs/design.md, "Klubben"). One row in
 * `membership_settings`, edited at /admin/medlemskap and printed on the
 * Klubben page and the join page, so the fee is written down once.
 */

type Row = Database["public"]["Tables"]["membership_settings"]["Row"]
export type MembershipSettings = Omit<Row, "id" | "updated_at">

const COLUMNS =
  "year, fee_adult, fee_youth, fee_family, youth_max_age, swish, bankgiro, contact_name, contact_email, contact_phone"

/** The row, or null when it can't be read. A failure costs the block, never the page. */
export async function loadMembership(db: SupabasePublicClient): Promise<MembershipSettings | null> {
  const { data, error } = await db.from("membership_settings").select(COLUMNS).maybeSingle()
  if (error) console.error(`mafk-web: load membership settings failed — ${error.message}`)
  return data ?? null
}

const digitsOf = (value: string) => value.replace(/\D/g, "")

/** "123 267 61 61" → "1232676161", or null when it isn't a Swish number. */
export function swishPayee(swish: string): string | null {
  const payee = digitsOf(swish)
  return /^\d{10}$/.test(payee) ? payee : null
}

/** What the Swish message should say: the name, then "medlem 2027". */
export const swishMessage = (year: number, name = "") =>
  [name.trim(), `medlem ${year}`].filter(Boolean).join(" ")

/** The name the page uses to show what a message looks like. */
export const EXAMPLE_NAME = "Anna Svensson"

/**
 * A link that opens Swish with the club's number and the message filled in.
 *
 * **Not documented by Swish.** It is the link Swish's own QR generator encodes
 * (`app.swish.nu/1/p/sw/?…&src=qr`), which a phone's camera also opens, so codes
 * in that form are already printed and in use; the parameters were mapped by
 * hand and tested on a phone in September 2026
 * (gist.github.com/Armandur/ead542b56cca2696b4286dbc05740da8). The page always
 * prints the number and the bankgiro as text too, so nothing depends on it.
 *
 * The message stays editable, so the payer can add their name to "medlem
 * 2027". Swish then lets the payee be edited as well; that is the app's rule
 * for any open field, and the payer can only send money elsewhere on purpose.
 * Without an amount, the amount is editable too: one QR code serves every fee.
 */
export function swishLink(
  swish: string,
  options: { year: number; amount?: number }
): string | null {
  const payee = swishPayee(swish)
  if (!payee) return null
  const parts = [`sw=${payee}`]
  if (options.amount !== undefined) parts.push(`amt=${options.amount}`, "cur=SEK")
  // %20, not URLSearchParams' "+": nothing says the app reads "+" as a space.
  parts.push(`msg=${encodeURIComponent(swishMessage(options.year))}`)
  parts.push(`edit=${options.amount === undefined ? "amt,msg" : "msg"}`, "src=qr")
  return `https://app.swish.nu/1/p/sw/?${parts.join("&")}`
}

/** A Swedish phone number as an international `tel:` href: "070-174 06 50" → "tel:+46701740650". */
export function telHref(phone: string): string | null {
  const digits = digitsOf(phone)
  if (digits.length < 6) return null
  if (phone.trim().startsWith("+")) return `tel:+${digits}`
  if (digits.startsWith("00")) return `tel:+${digits.slice(2)}`
  if (digits.startsWith("0")) return `tel:+46${digits.slice(1)}`
  return null
}

/** The text a new member sends with their postal address; the same by email and by SMS. */
export function addressMessage(year: number): string {
  return [
    `Hej! Jag har betalat medlemsavgiften för ${year}.`,
    "",
    "Namn:",
    "Adress:",
    "Postnummer och ort:",
  ].join("\n")
}

/** A prefilled email to whoever takes new members' addresses. */
export function addressMailto(email: string, year: number): string {
  const subject = encodeURIComponent(`Ny medlem ${year}`)
  return `mailto:${email}?subject=${subject}&body=${encodeURIComponent(addressMessage(year))}`
}

/**
 * The same as an SMS. `?&body=` is the spelling both phone platforms accept:
 * Android reads `?body=`, older iOS `&body=`.
 */
export function addressSms(phone: string, year: number): string | null {
  const tel = telHref(phone)
  return tel
    ? `sms:${tel.slice("tel:".length)}?&body=${encodeURIComponent(addressMessage(year))}`
    : null
}

// The admin form

export type MembershipInput = MembershipSettings

export const MEMBERSHIP_MESSAGES = {
  year: "Ange ett årtal, till exempel 2027.",
  fee: "Ange avgiften i hela kronor, till exempel 100.",
  youthAge: "Ange en ålder mellan 1 och 99.",
  swish:
    "Ett Swishnummer har tio siffror, till exempel 123 267 61 61. Lämna tomt om ni inte har Swish.",
  bankgiro: "Skriv bankgironumret med bindestreck, till exempel 5661-4969, eller lämna tomt.",
  name: "Namnet får vara högst 100 tecken.",
  email: "Skriv en e-postadress, till exempel kassor@markarydsfagelklubb.nu.",
  phone: "Skriv numret med siffror, mellanslag och bindestreck, till exempel 070-174 06 50.",
  contactMissing:
    "Fyll i minst en e-postadress eller ett telefonnummer, så att nya medlemmar kan skicka sin adress.",
} as const

// The same rules as the checks in the migration (20261024092714).
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/
const PHONE = /^\+?[0-9][0-9 -]{5,19}$/
const BANKGIRO = /^[0-9]{3,4}-[0-9]{4}$/

function text(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""
}

function wholeNumber(raw: string, min: number, max: number): number | null {
  if (!/^\d{1,6}$/.test(raw)) return null
  const value = Number(raw)
  return value >= min && value <= max ? value : null
}

export function parseMembershipForm(form: FormData): Parsed<MembershipInput> {
  const errors: FieldErrors = {}

  const year = wholeNumber(text(form, "year"), 2000, 2100)
  if (year === null) errors.year = MEMBERSHIP_MESSAGES.year
  const fee = (name: "fee_adult" | "fee_youth" | "fee_family") => {
    const value = wholeNumber(text(form, name).replace(/\s*kr$/i, ""), 0, 100000)
    if (value === null) errors[name] = MEMBERSHIP_MESSAGES.fee
    return value ?? 0
  }
  const fees = {
    fee_adult: fee("fee_adult"),
    fee_youth: fee("fee_youth"),
    fee_family: fee("fee_family"),
  }
  const youthAge = wholeNumber(text(form, "youth_max_age"), 1, 99)
  if (youthAge === null) errors.youth_max_age = MEMBERSHIP_MESSAGES.youthAge

  const swish = text(form, "swish")
  if (swish !== "" && swishPayee(swish) === null) errors.swish = MEMBERSHIP_MESSAGES.swish
  const bankgiro = text(form, "bankgiro")
  if (bankgiro !== "" && !BANKGIRO.test(bankgiro)) errors.bankgiro = MEMBERSHIP_MESSAGES.bankgiro

  const contactName = text(form, "contact_name")
  if (contactName.length > 100) errors.contact_name = MEMBERSHIP_MESSAGES.name
  const contactEmail = text(form, "contact_email")
  if (contactEmail !== "" && !EMAIL.test(contactEmail))
    errors.contact_email = MEMBERSHIP_MESSAGES.email
  const contactPhone = text(form, "contact_phone")
  if (contactPhone !== "" && !PHONE.test(contactPhone))
    errors.contact_phone = MEMBERSHIP_MESSAGES.phone
  if (
    contactEmail === "" &&
    contactPhone === "" &&
    !errors.contact_email &&
    !errors.contact_phone
  ) {
    errors.contact_email = MEMBERSHIP_MESSAGES.contactMissing
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      year: year ?? 0,
      ...fees,
      youth_max_age: youthAge ?? 0,
      swish,
      bankgiro,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
    },
  }
}
