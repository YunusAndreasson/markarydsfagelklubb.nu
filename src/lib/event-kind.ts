/**
 * What kind of thing an event is (docs/roadmap.md, F3). A fixed list rather
 * than the article `categories` table: those hold Referat and
 * Föreningsaktuellt, which are not things you can attend.
 *
 * The values are stored as written here and repeated by the check constraint in
 * the migration, so a value that reaches the database is always one of these.
 */

export const EVENT_KINDS = [
  "exkursion",
  "mote",
  "resa",
  "kurs",
  "tavling",
  "arbetsdag",
  "ovrigt",
] as const

export type EventKind = (typeof EVENT_KINDS)[number]

/** What the admin picks from, in the order the list is shown. */
export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  exkursion: "Exkursion",
  mote: "Möte",
  resa: "Resa",
  kurs: "Kurs",
  tavling: "Tävling",
  arbetsdag: "Arbetsdag",
  ovrigt: "Övrigt",
}

/** Nothing else to say about it: the title already carries what it is. */
export const DEFAULT_EVENT_KIND: EventKind = "ovrigt"

export function isEventKind(value: unknown): value is EventKind {
  return typeof value === "string" && (EVENT_KINDS as readonly string[]).includes(value)
}

/**
 * The word the public sees, or null when there is none. "Övrigt" is a filing
 * decision, not information for a member reading the program.
 */
export function publicEventKindLabel(value: string): string | null {
  if (!isEventKind(value) || value === DEFAULT_EVENT_KIND) return null
  return EVENT_KIND_LABELS[value]
}
