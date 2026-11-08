import { DEFAULT_EVENT_KIND, type EventKind, isEventKind } from "./event-kind"
import { MONTH_KEY_PATTERN } from "./event-month"
import { isValidSlug, RESERVED_ARTICLE_SLUGS, RESERVED_TOP_LEVEL_SLUGS, slugify } from "./slug"
import { parseStockholmInputValue, startOfStockholmDay } from "./stockholm-time"

/**
 * The admin's edit forms, read and checked. Pure, so every rule is tested
 * here rather than in the pages. The database repeats the rules that matter
 * for safety (slug shape, `link_url`), so neither side trusts the other.
 *
 * Bodies come back as typed: the page sanitizes them before saving.
 *
 * The body and the cover come from islands that exist only once JavaScript
 * has run. A form posted without them (JS blocked, still loading) must not
 * erase what is saved, so a missing field reads as `null`/`undefined`:
 * "leave it as it is".
 */

/** Field name → message, in the same words the form shows. */
export type FieldErrors = Record<string, string>

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors }

export const LIMITS = {
  title: 200,
  excerpt: 400,
  author: 100,
  description: 300,
  place: 120,
  contactName: 100,
  contactPhone: 30,
} as const

export const MESSAGES = {
  titleMissing: "Skriv en rubrik.",
  titleTooLong: `Rubriken får vara högst ${LIMITS.title} tecken.`,
  nameMissing: "Skriv ett namn.",
  slugMissing: "Rubriken ger ingen adress. Skriv en själv med a–z, 0–9 och bindestreck.",
  slugInvalid:
    "Adressen får bara innehålla a–z, 0–9 och enkla bindestreck, till exempel ”strackrakning-skararp”.",
  slugReserved: (slug: string) => `Adressen ”${slug}” används redan av webbplatsen. Välj en annan.`,
  excerptTooLong: `Ingressen får vara högst ${LIMITS.excerpt} tecken.`,
  authorTooLong: `Namnet får vara högst ${LIMITS.author} tecken.`,
  descriptionTooLong: `Beskrivningen får vara högst ${LIMITS.description} tecken.`,
  contactNameTooLong: `Namnet får vara högst ${LIMITS.contactName} tecken.`,
  contactPhoneInvalid: "Skriv telefonnumret med siffror, till exempel 070-174 06 50.",
  deadlineInvalid: "Ange ett datum, till exempel 2026-11-24.",
  publishAtInvalid: "Ange datum och tid, till exempel 2026-09-19 10:00.",
  placeTooLong: `Platsen får vara högst ${LIMITS.place} tecken.`,
  startMissing: "Ange när det börjar.",
  startInvalid: "Ange datum och tid, till exempel 2026-10-03 18:00.",
  endInvalid: "Ange datum och tid, eller lämna tomt.",
  endBeforeStart: "Sluttiden ligger före starttiden.",
  slugMonthShape:
    "Adressen får inte se ut som en månad (2026-10). Kalendern använder den formen för sina månadssidor.",
  choiceInvalid: "Välj ett av alternativen i listan.",
  parentInvalid: "En sida kan inte ligga under sig själv eller under sina egna undersidor.",
  linkUrlInvalid: "Länken måste börja med https://, http://, mailto: eller / för en sida här.",
} as const

// The same rule as the pages_link_url_shape check in the migration.
const LINK_URL = /^(https?:\/\/\S+|mailto:\S+|\/([^/\s]\S*)?)$/

function text(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === "string" ? value.trim() : ""
}

/** The raw body, or null when the editor never sent one. */
function body(form: FormData): string | null {
  const value = form.get("body_html")
  return typeof value === "string" ? value : null
}

/** "" → null; a positive integer → itself; anything else → undefined (invalid). */
function optionalId(raw: string): number | null | undefined {
  if (raw === "") return null
  return /^[1-9]\d{0,15}$/.test(raw) ? Number(raw) : undefined
}

function checkTitle(title: string, errors: FieldErrors, field = "title"): void {
  if (!title) errors[field] = field === "name" ? MESSAGES.nameMissing : MESSAGES.titleMissing
  else if (title.length > LIMITS.title) errors[field] = MESSAGES.titleTooLong
}

/** The typed slug, or one made from the title when the field was left empty. */
function checkSlug(
  typed: string,
  title: string,
  reserved: ReadonlySet<string>,
  errors: FieldErrors
): string {
  const slug = typed ? typed.toLowerCase() : slugify(title)
  if (!slug) {
    if (title) errors.slug = MESSAGES.slugMissing
  } else if (!isValidSlug(slug)) {
    errors.slug = MESSAGES.slugInvalid
  } else if (reserved.has(slug)) {
    errors.slug = MESSAGES.slugReserved(slug)
  }
  return slug
}

function checkPublishAt(raw: string, errors: FieldErrors): Date | null {
  if (!raw) return null
  const parsed = parseStockholmInputValue(raw)
  if (!parsed) errors.publish_at = MESSAGES.publishAtInvalid
  return parsed
}

function checkId(raw: string, field: string, errors: FieldErrors): number | null {
  const id = optionalId(raw)
  if (id === undefined) {
    errors[field] = MESSAGES.choiceInvalid
    return null
  }
  return id
}

function checkLength(
  value: string,
  max: number,
  field: string,
  message: string,
  errors: FieldErrors
) {
  if (value.length > max) errors[field] = message
}

function done<T>(errors: FieldErrors, value: T): Parsed<T> {
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value }
}

export type ArticleForm = {
  title: string
  slug: string
  excerpt: string
  author_name: string
  category_id: number | null
  /** undefined: the cover picker wasn't there, keep the saved cover. */
  cover_media_id: number | null | undefined
  /** null: the editor wasn't there, keep the saved body. */
  body_html: string | null
  publish_at: Date | null
}

export function parseArticleForm(form: FormData): Parsed<ArticleForm> {
  const errors: FieldErrors = {}
  const title = text(form, "title")
  checkTitle(title, errors)
  const slug = checkSlug(text(form, "slug"), title, RESERVED_ARTICLE_SLUGS, errors)
  const excerpt = text(form, "excerpt")
  checkLength(excerpt, LIMITS.excerpt, "excerpt", MESSAGES.excerptTooLong, errors)
  const author_name = text(form, "author_name")
  checkLength(author_name, LIMITS.author, "author_name", MESSAGES.authorTooLong, errors)

  return done(errors, {
    title,
    slug,
    excerpt,
    author_name,
    category_id: checkId(text(form, "category_id"), "category_id", errors),
    cover_media_id: form.has("cover_media_id")
      ? checkId(text(form, "cover_media_id"), "cover_media_id", errors)
      : undefined,
    body_html: body(form),
    publish_at: checkPublishAt(text(form, "publish_at"), errors),
  })
}

export type EventForm = {
  title: string
  slug: string
  summary: string
  place: string
  kind: EventKind
  registration_url: string | null
  contact_name: string
  contact_phone: string
  /** "2026-11-24": a day, as the column stores it. */
  signup_deadline: string | null
  starts_at: Date
  ends_at: Date | null
  all_day: boolean
  /** null: the editor wasn't there, keep the saved description. */
  body_html: string | null
  publish_at: Date | null
}

/** A required datetime-local field, unlike the optional publish time. */
function checkStart(raw: string, errors: FieldErrors): Date | null {
  if (!raw) {
    errors.starts_at = MESSAGES.startMissing
    return null
  }
  const parsed = parseStockholmInputValue(raw)
  if (!parsed) errors.starts_at = MESSAGES.startInvalid
  return parsed
}

export function parseEventForm(form: FormData): Parsed<EventForm> {
  const errors: FieldErrors = {}
  const title = text(form, "title")
  checkTitle(title, errors)

  const slug = checkSlug(text(form, "slug"), title, new Set(), errors)
  // /kalender/2026-10 is a month page, so an event can't be called that.
  if (!errors.slug && MONTH_KEY_PATTERN.test(slug)) errors.slug = MESSAGES.slugMonthShape

  const summary = text(form, "summary")
  checkLength(summary, LIMITS.excerpt, "summary", MESSAGES.excerptTooLong, errors)
  const place = text(form, "place")
  checkLength(place, LIMITS.place, "place", MESSAGES.placeTooLong, errors)

  const rawKind = text(form, "kind")
  if (rawKind && !isEventKind(rawKind)) errors.kind = MESSAGES.choiceInvalid
  const kind = isEventKind(rawKind) ? rawKind : DEFAULT_EVENT_KIND

  const registrationUrl = text(form, "registration_url")
  if (registrationUrl && !LINK_URL.test(registrationUrl)) {
    errors.registration_url = MESSAGES.linkUrlInvalid
  }

  const contactName = text(form, "contact_name")
  checkLength(contactName, LIMITS.contactName, "contact_name", MESSAGES.contactNameTooLong, errors)
  const contactPhone = text(form, "contact_phone")
  if (
    contactPhone &&
    (contactPhone.length > LIMITS.contactPhone || !/^\+?[\d\s–-]{5,}$/.test(contactPhone))
  ) {
    errors.contact_phone = MESSAGES.contactPhoneInvalid
  }
  const deadline = text(form, "signup_deadline")
  if (deadline && !parseStockholmInputValue(`${deadline}T12:00`)) {
    errors.signup_deadline = MESSAGES.deadlineInvalid
  }

  const allDay = form.get("all_day") === "on"
  // An all-day event keeps whatever hour was left in the form out of the
  // database: the day is the whole fact.
  const atDay = (value: Date) => (allDay ? startOfStockholmDay(value) : value)

  const start = checkStart(text(form, "starts_at"), errors)
  const rawEnd = text(form, "ends_at")
  let end: Date | null = null
  if (rawEnd) {
    end = parseStockholmInputValue(rawEnd)
    if (!end) errors.ends_at = MESSAGES.endInvalid
  }
  if (start && end && atDay(end).getTime() < atDay(start).getTime()) {
    errors.ends_at = MESSAGES.endBeforeStart
  }

  // Checked before the guard below, so a bad start time doesn't hide a bad
  // publishing time: the form reports every problem at once.
  const publishAt = checkPublishAt(text(form, "publish_at"), errors)

  // The one field nothing can stand in for: without it there is no event.
  if (!start) return { ok: false, errors }

  return done(errors, {
    title,
    slug,
    summary,
    place,
    kind,
    registration_url: registrationUrl || null,
    contact_name: contactName,
    contact_phone: contactPhone,
    signup_deadline: deadline || null,
    starts_at: atDay(start),
    ends_at: end ? atDay(end) : null,
    all_day: allDay,
    body_html: body(form),
    publish_at: publishAt,
  })
}

type TreeRules = {
  /** The page itself and everything below it: none of them can be its parent. */
  forbiddenParentIds?: ReadonlySet<number>
}

function checkParent(form: FormData, rules: TreeRules, errors: FieldErrors): number | null {
  const parentId = checkId(text(form, "parent_id"), "parent_id", errors)
  if (parentId !== null && rules.forbiddenParentIds?.has(parentId)) {
    errors.parent_id = MESSAGES.parentInvalid
  }
  return parentId
}

export type PageForm = {
  title: string
  slug: string
  parent_id: number | null
  show_in_menu: boolean
  description: string
  /** null: the editor wasn't there, keep the saved body. */
  body_html: string | null
  publish_at: Date | null
}

export function parsePageForm(form: FormData, rules: TreeRules = {}): Parsed<PageForm> {
  const errors: FieldErrors = {}
  const title = text(form, "title")
  checkTitle(title, errors)
  const parent_id = checkParent(form, rules, errors)
  // Only a top-level page can collide with the site's own routes.
  const reserved = parent_id === null ? RESERVED_TOP_LEVEL_SLUGS : new Set<string>()
  const slug = checkSlug(text(form, "slug"), title, reserved, errors)
  const description = text(form, "description")
  checkLength(description, LIMITS.description, "description", MESSAGES.descriptionTooLong, errors)

  return done(errors, {
    title,
    slug,
    parent_id,
    show_in_menu: form.get("show_in_menu") === "on",
    description,
    body_html: body(form),
    publish_at: checkPublishAt(text(form, "publish_at"), errors),
  })
}

export type LinkForm = {
  title: string
  slug: string
  link_url: string
  parent_id: number | null
  show_in_menu: boolean
}

export function parseLinkForm(form: FormData, rules: TreeRules = {}): Parsed<LinkForm> {
  const errors: FieldErrors = {}
  const title = text(form, "title")
  checkTitle(title, errors)
  const parent_id = checkParent(form, rules, errors)
  // A link is never served at its slug; the slug only keeps siblings apart.
  const slug = checkSlug(text(form, "slug"), title, new Set(), errors)
  const link_url = text(form, "link_url")
  if (!LINK_URL.test(link_url)) errors.link_url = MESSAGES.linkUrlInvalid

  return done(errors, {
    title,
    slug,
    link_url,
    parent_id,
    show_in_menu: form.get("show_in_menu") === "on",
  })
}

export type CategoryForm = { name: string; slug: string }

export function parseCategoryForm(form: FormData): Parsed<CategoryForm> {
  const errors: FieldErrors = {}
  const name = text(form, "name")
  checkTitle(name, errors, "name")
  const slug = checkSlug(text(form, "slug"), name, new Set(), errors)
  return done(errors, { name, slug })
}

export type LokalPointForm = {
  name: string
  note: string
  kind: "practical" | "place"
  latitude: number | null
  longitude: number | null
  sort_order: number
}

/** A place on a lokal (`/admin/lokalplatser`). Position: both or neither. */
export function parseLokalPointForm(form: FormData): Parsed<LokalPointForm> {
  const errors: FieldErrors = {}
  const name = text(form, "name")
  checkTitle(name, errors, "name")
  const decimal = (field: string, low: number, high: number) => {
    const raw = text(form, field).replace(",", ".")
    if (raw === "") return null
    const value = Number(raw)
    if (Number.isFinite(value) && value >= low && value <= high) return value
    errors[field] = "Skriv ett decimaltal, till exempel 56.6446."
    return null
  }
  const latitude = decimal("latitude", -90, 90)
  const longitude = decimal("longitude", -180, 180)
  if (!errors.latitude && !errors.longitude && (latitude === null) !== (longitude === null)) {
    errors.latitude = "Fyll i både latitud och longitud, eller ingen av dem."
  }
  const order = Number(text(form, "sort_order") || "0")
  return done(errors, {
    name,
    note: text(form, "note"),
    kind: text(form, "kind") === "practical" ? "practical" : "place",
    latitude,
    longitude,
    sort_order: Number.isInteger(order) ? order : 0,
  })
}

/** A row id from a route parameter, or null for anything that isn't one. */
export function parseRouteId(value: string | undefined): number | null {
  return value !== undefined && /^[1-9]\d{0,15}$/.test(value) ? Number(value) : null
}
