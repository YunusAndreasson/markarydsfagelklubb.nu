import sanitizeHtml from "sanitize-html"
import { isAllowedEmbed } from "./embeds"
import { isSiteMediaUrl } from "./media"

/**
 * The one gate between an editor and the database (docs/roadmap.md, D5).
 *
 * Every article and page body passes through here **on save**, never on
 * render: a stolen admin session must not be able to plant a script, and
 * rendering stays cheap. The WordPress import (step 8) uses the same function.
 *
 * The allowlist is exactly what the editor can hold. HTML outside it would be
 * dropped the next time someone edits the text anyway, so dropping it here
 * keeps what's stored honest. A test round-trips the editor's own output.
 *
 * Cost, measured 2026-09-19: about 0.8 ms for a 6 KB article once warm; a
 * deliberately huge 89 KB page took 24 ms cold in workerd. Workers Free allows
 * 10 ms of CPU, so a save of an enormous page could be refused. If that
 * happens, the faster `xss` package is the fallback.
 */

const TEXT_TAGS = ["p", "h2", "h3", "h4", "strong", "em", "s", "u", "br", "hr", "blockquote"]
const LIST_TAGS = ["ul", "ol", "li"]
const TABLE_TAGS = ["table", "tbody", "tr", "th", "td"]

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...TEXT_TAGS, ...LIST_TAGS, ...TABLE_TAGS, "a", "img", "iframe"],
  // No `class` and no `style` anywhere: the site's stylesheet decides looks.
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    ol: ["start"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
    img: ["src", "srcset", "sizes", "width", "height", "alt", "title", "loading"],
    iframe: ["src", "title", "loading", "allowfullscreen"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https"], iframe: ["https"] },
  allowProtocolRelative: false,
  transformTags: {
    // A link that opens a new tab must not hand that tab a handle back to us.
    a: (tagName, attribs) => {
      const next = { ...attribs }
      if (next.target !== undefined && next.target !== "_blank") delete next.target
      if (next.target === "_blank" && !/\bnoopener\b/.test(next.rel ?? "")) {
        next.rel = [next.rel, "noopener noreferrer"].filter(Boolean).join(" ")
      }
      return { tagName, attribs: next }
    },
    iframe: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
    img: (tagName, attribs) => ({
      tagName,
      attribs: attribs.loading === "eager" ? attribs : { ...attribs, loading: "lazy" },
    }),
  },
  // Drop the element entirely (not just the attribute) when its source is not
  // ours: an <img> from elsewhere is a tracking pixel waiting to happen, and
  // an <iframe> from elsewhere is someone else's page inside ours.
  exclusiveFilter: (frame) => {
    if (frame.tag === "img") {
      const src = frame.attribs.src ?? ""
      if (!isSiteMediaUrl(src)) return true
      const srcset = frame.attribs.srcset
      return srcset !== undefined && !srcsetIsSiteMedia(srcset)
    }
    if (frame.tag === "iframe") return !isAllowedEmbed(frame.attribs.src ?? "")
    return false
  },
}

/** Every candidate URL in a srcset must be one of ours. */
function srcsetIsSiteMedia(srcset: string): boolean {
  const candidates = srcset
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean)
  return (
    candidates.length > 0 &&
    candidates.every((candidate) => isSiteMediaUrl(candidate.split(/\s+/)[0] ?? ""))
  )
}

export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim()
}
