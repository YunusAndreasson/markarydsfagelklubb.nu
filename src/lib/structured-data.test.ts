import { describe, expect, it } from "vitest"
import {
  articleNode,
  breadcrumbList,
  capHeadline,
  eventNode,
  HEADLINE_MAX,
  jsonLdGraph,
  jsonLdText,
  ORGANIZATION_ID,
  websiteNode,
} from "./structured-data"

const CLUB = { "@id": "https://markarydsfagelklubb.nu/#organization" }

describe("jsonLdText", () => {
  it("leaves no `<` that could close the script element", () => {
    const text = jsonLdText({ name: "</script><script>alert(1)</script>" })
    expect(text).not.toContain("<")
    expect(JSON.parse(text)).toEqual({ name: "</script><script>alert(1)</script>" })
  })
})

describe("jsonLdGraph", () => {
  it("puts the nodes under one context", () => {
    expect(jsonLdGraph([websiteNode()])).toEqual({
      "@context": "https://schema.org",
      "@graph": [websiteNode()],
    })
  })
})

describe("websiteNode", () => {
  it("names the site and points at the club", () => {
    expect(websiteNode()).toEqual({
      "@type": "WebSite",
      "@id": "https://markarydsfagelklubb.nu/#website",
      name: "Markaryds Fågelklubb",
      url: "https://markarydsfagelklubb.nu/",
      publisher: CLUB,
    })
    expect(ORGANIZATION_ID).toBe(CLUB["@id"])
  })
})

describe("eventNode", () => {
  const url = "https://markarydsfagelklubb.nu/kalender/motesplats-ekebacken-7-april"
  const timed = {
    title: "Mötesplats Ekebacken",
    summary: "Vi ses vid fågeltornet.",
    place: "Ekebacken",
    starts_at: "2026-04-07T16:30:00+00:00",
    ends_at: "2026-04-07T19:00:00+00:00",
    all_day: false,
  }

  it("gives a timed event its clock with Stockholm's offset", () => {
    expect(eventNode(timed, url)).toEqual({
      "@type": "Event",
      name: "Mötesplats Ekebacken",
      description: "Vi ses vid fågeltornet.",
      url,
      startDate: "2026-04-07T18:30:00+02:00",
      endDate: "2026-04-07T21:00:00+02:00",
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: {
        "@type": "Place",
        name: "Ekebacken",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Markaryd",
          addressRegion: "Kronobergs län",
          addressCountry: "SE",
        },
      },
      organizer: CLUB,
    })
  })

  it("gives an all-day event its days alone", () => {
    // Smålandsrallyt, 31/10 – 1/11: each day stored as its Stockholm midnight.
    const node = eventNode(
      {
        ...timed,
        starts_at: "2026-10-30T23:00:00+00:00",
        ends_at: "2026-10-31T23:00:00+00:00",
        all_day: true,
      },
      url
    )
    expect(node.startDate).toBe("2026-10-31")
    expect(node.endDate).toBe("2026-11-01")
  })

  it("leaves out what the event doesn't say, and places it in the kommun", () => {
    const node = eventNode({ ...timed, summary: " ", place: "", ends_at: null }, url)
    expect(node).not.toHaveProperty("description")
    expect(node).not.toHaveProperty("endDate")
    expect(node.location).toMatchObject({ "@type": "Place", name: "Markaryds kommun" })
  })
})

describe("capHeadline", () => {
  it("keeps a headline that fits", () => {
    expect(capHeadline("  Vinterfågelrally 2026 ")).toBe("Vinterfågelrally 2026")
    const exact = "a".repeat(HEADLINE_MAX)
    expect(capHeadline(exact)).toBe(exact)
  })

  it("cuts a long one at a word, within the limit", () => {
    const title = `${"Fåglar vid Hultasjön, ".repeat(6)}och mer`
    const capped = capHeadline(title)
    expect(Array.from(capped).length).toBeLessThanOrEqual(HEADLINE_MAX)
    expect(capped.endsWith("Hultasjön…")).toBe(true)
    expect(capHeadline("ord ".repeat(40))).toBe(`${"ord ".repeat(27).trim()}…`)
  })

  it("cuts one long word where it must", () => {
    const capped = capHeadline("x".repeat(200))
    expect(capped).toBe(`${"x".repeat(HEADLINE_MAX - 1)}…`)
  })
})

describe("articleNode", () => {
  const url = "https://markarydsfagelklubb.nu/artiklar/infor-smalandsrallyt"
  const article = {
    title: "Inför Smålandsrallyt",
    published_at: "2025-10-20T08:00:00+00:00",
    updated_at: "2026-10-24T20:29:57.836+00:00",
  }

  it("dates the article on Stockholm's clock and names the club", () => {
    expect(articleNode(article, url, "https://example.supabase.co/storage/v1/x/960.webp")).toEqual({
      "@type": "Article",
      headline: "Inför Smålandsrallyt",
      datePublished: "2025-10-20T10:00:00+02:00",
      dateModified: "2026-10-24T22:29:57+02:00",
      image: "https://example.supabase.co/storage/v1/x/960.webp",
      author: CLUB,
      publisher: CLUB,
      mainEntityOfPage: url,
    })
  })

  it("makes a root-relative photo absolute, and leaves out a missing one", () => {
    expect(articleNode(article, url, "/_astro/photo.webp").image).toBe(
      "https://markarydsfagelklubb.nu/_astro/photo.webp"
    )
    expect(articleNode(article, url, null)).not.toHaveProperty("image")
  })

  it("never says it was modified before it was published", () => {
    const scheduled = { ...article, updated_at: "2025-10-01T08:00:00+00:00" }
    expect(articleNode(scheduled, url, null).dateModified).toBe("2025-10-20T10:00:00+02:00")
  })
})

describe("breadcrumbList", () => {
  const page = { name: "Mandarinand", url: "https://markarydsfagelklubb.nu/arter/mandarinand" }

  it("lists the crumbs on the site's address, then the page", () => {
    expect(
      breadcrumbList(
        [{ href: "/obsar/markarydslistan?ordning=a-o", label: "Markarydslistan" }],
        page
      )
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Markarydslistan",
          item: "https://markarydsfagelklubb.nu/obsar/markarydslistan?ordning=a-o",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Mandarinand",
          item: "https://markarydsfagelklubb.nu/arter/mandarinand",
        },
      ],
    })
  })

  it("numbers a longer trail in order", () => {
    const list = breadcrumbList(
      [
        { href: "/kalender", label: "Program" },
        { href: "/kalender/2026-04", label: "April 2026" },
      ],
      { name: "Mötesplats Ekebacken", url: "https://markarydsfagelklubb.nu/kalender/x" }
    )
    expect(list?.itemListElement).toMatchObject([
      { position: 1, item: "https://markarydsfagelklubb.nu/kalender" },
      { position: 2, item: "https://markarydsfagelklubb.nu/kalender/2026-04" },
      { position: 3, name: "Mötesplats Ekebacken" },
    ])
  })

  it("says nothing without crumbs", () => {
    expect(breadcrumbList([], page)).toBeNull()
  })
})
