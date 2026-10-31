import { startOfStockholmDay } from "./stockholm-time"

/**
 * Where an event stands today, so a member doesn't have to work it out from the
 * date. Days are Stockholm days, and an end on a later day includes that day: an
 * all-day event stores its last day as that day's midnight, so Smålandsrallyt
 * "31/10 – 1/11" is still on all through the Sunday.
 */
export type EventStatus = "past" | "today" | "ongoing" | "upcoming"

type Timed = { starts_at: string; ends_at: string | null }

const dayOf = (value: Date | string) => startOfStockholmDay(value).getTime()

export function eventStatus(event: Timed, now: Date): EventStatus {
  const today = dayOf(now)
  const first = dayOf(event.starts_at)
  const last = event.ends_at ? Math.max(dayOf(event.ends_at), first) : first
  if (today < first) return "upcoming"
  if (today > last) return "past"
  return first === last || today === first ? "today" : "ongoing"
}

/** The word the programme prints for an event happening now, or null. */
export function eventStatusLabel(status: EventStatus): string | null {
  if (status === "today") return "I dag"
  return status === "ongoing" ? "Pågår" : null
}

/** A `date` column as an instant inside that Stockholm day. */
export const deadlineInstant = (deadline: string) => `${deadline}T12:00:00Z`

/** A sign-up holds through its last day, and not past the event itself. */
export function signupOpen(event: Timed & { signup_deadline: string | null }, now: Date): boolean {
  if (eventStatus(event, now) === "past") return false
  if (!event.signup_deadline) return true
  return dayOf(now) <= dayOf(deadlineInstant(event.signup_deadline))
}

/** "070-174 06 05" as a `tel:` link, or null when there are no digits to dial. */
export function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "")
  return digits ? `tel:${digits}` : null
}
