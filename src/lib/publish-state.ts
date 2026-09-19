/**
 * Drafts and scheduled publishing (docs/roadmap.md, D5). The database stores
 * two facts, `status` and `published_at`; "scheduled" is derived: published,
 * but not yet due. The anon policies apply the same rule, so what the admin
 * list calls "Publicerad" is exactly what a visitor can see.
 */

export type PublishState = "draft" | "scheduled" | "published"

export const PUBLISH_STATE_LABELS: Record<PublishState, string> = {
  draft: "Utkast",
  scheduled: "Schemalagd",
  published: "Publicerad",
}

type Publishable = { status: string; published_at: string | null }

export function publishStateOf(row: Publishable, now: Date): PublishState {
  if (row.status !== "published" || row.published_at === null) return "draft"
  return new Date(row.published_at).getTime() > now.getTime() ? "scheduled" : "published"
}

/** The buttons on the edit form. */
export type PublishIntent = "save" | "publish" | "unpublish"

export function parsePublishIntent(value: unknown): PublishIntent | null {
  return value === "save" || value === "publish" || value === "unpublish" ? value : null
}

/**
 * What a press of one of the buttons stores.
 *
 * - *Spara* keeps the current status. A published item keeps its time unless
 *   a new one is typed in.
 * - *Publicera* publishes at the typed time, or now. A time in the future
 *   schedules it.
 * - *Avpublicera* turns it back into a draft and remembers the time, so
 *   publishing again without typing one keeps the original date.
 */
export function resolvePublication(
  intent: PublishIntent,
  current: Publishable | null,
  requestedAt: Date | null,
  now: Date
): { status: "draft" | "published"; published_at: string | null } {
  const keptTime = requestedAt?.toISOString() ?? current?.published_at ?? null

  if (intent === "publish") {
    return { status: "published", published_at: requestedAt?.toISOString() ?? now.toISOString() }
  }
  if (intent === "unpublish" || current?.status !== "published") {
    return { status: "draft", published_at: keptTime }
  }
  return { status: "published", published_at: keptTime ?? now.toISOString() }
}
