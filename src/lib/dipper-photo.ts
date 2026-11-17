/**
 * The club's emblem bird in its own water, from the article "Strömstarens
 * ankomst": Klubben's opening photo, and the visitor pages' picture of the club
 * (docs/design.md, "Besökare"). The media library keeps it at three widths.
 */
const BASE =
  "https://zgnmajovyqibgxlcomvb.supabase.co/storage/v1/object/public/site-media/2025/10/93398403-259e-5fed-b5f8-6d82268fbbfa"

export const DIPPER_PHOTO = {
  src: `${BASE}/960.webp`,
  srcset: `${BASE}/480.webp 480w, ${BASE}/960.webp 960w, ${BASE}/1600.webp 1600w`,
  width: 1657,
  height: 1105,
  photographer: "Lars-Erik Andréasson",
} as const
