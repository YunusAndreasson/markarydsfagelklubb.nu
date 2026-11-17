import { describe, expect, it } from "vitest"
import { otherLanguages, VISITOR_ALTERNATES, VISITOR_LANGUAGES } from "./languages"
import { type LokalSummary, lokalSlug } from "./lokal"
import {
  GUIDE,
  type InlineLink,
  osmUrl,
  type Paragraph,
  RECOMMENDED_SITES,
  recentlyAlerted,
  recommendedSites,
  visitorDay,
  visitorNumber,
  visitorPins,
} from "./visitor-guide"

const lokal = (id: number, name: string, extra: Partial<LokalSummary> = {}): LokalSummary => ({
  id,
  name,
  slug: lokalSlug(name),
  latitude: 56.53301,
  longitude: 13.64271,
  description: null,
  alertCount: 0,
  lastAlertAt: null,
  active: false,
  recentSpecies: [],
  ...extra,
})

describe("the visitor languages", () => {
  it("name each language in itself and point at the two pages", () => {
    expect(VISITOR_LANGUAGES.map(({ label, href }) => [label, href])).toEqual([
      ["English", "/en"],
      ["Deutsch", "/de"],
    ])
    expect(VISITOR_ALTERNATES).toEqual([
      { lang: "en", href: "/en" },
      { lang: "de", href: "/de" },
    ])
  })

  it("switch to the other languages only, in one order, Swedish being the home page", () => {
    const labels = (lang: "sv" | "en" | "de") =>
      otherLanguages(lang).map(({ label, href }) => `${label} ${href}`)
    expect(labels("sv")).toEqual(["English /en", "Deutsch /de"])
    expect(labels("en")).toEqual(["Svenska /", "Deutsch /de"])
    expect(labels("de")).toEqual(["Svenska /", "English /en"])
  })
})

describe("GUIDE", () => {
  const links = (paragraphs: readonly Paragraph[]) =>
    paragraphs
      .flat()
      .filter((part): part is InlineLink => typeof part !== "string" && "href" in part)

  it("links to the same places in both languages", () => {
    for (const section of ["report", "access"] as const) {
      const en = links(GUIDE.en[section].paragraphs).filter((link) => !link.external)
      const de = links(GUIDE.de[section].paragraphs).filter((link) => !link.external)
      expect(en.map((link) => link.href)).toEqual(de.map((link) => link.href))
    }
    expect(links(GUIDE.en.club.paragraphs).map((link) => link.href)).toEqual(
      links(GUIDE.de.club.paragraphs).map((link) => link.href)
    )
  })

  it("marks every link into the Swedish site as Swedish", () => {
    for (const copy of Object.values(GUIDE)) {
      for (const section of [copy.report, copy.access, copy.club]) {
        for (const link of links(section.paragraphs)) {
          if (link.href.startsWith("/")) expect(link.hreflang, link.href).toBe("sv")
        }
      }
    }
  })
})

describe("recommendedSites", () => {
  const all = [
    lokal(8, "Skararps ängar"),
    lokal(7, "Köphultasjön"),
    lokal(3, "Altaböke sjö"),
    lokal(2, "Lokasjöområdet"),
    lokal(99, "Reningsdammarna"),
  ]

  it("keeps the guide's order and the reader's language", () => {
    const sites = recommendedSites(all, "de")
    expect(sites.map((site) => site.name)).toEqual([
      "Altaböke sjö",
      "Lokasjöområdet",
      "Köphultasjön",
      "Skararps ängar",
    ])
    expect(sites[0]?.line).toBe("Ein Feuchtgebiet bei Altaböke mit Vogelturm.")
    expect(sites[0]?.slug).toBe("altaboke-sjo")
  })

  it("joins on the id, so a renamed lokal keeps its line", () => {
    const renamed = recommendedSites([lokal(3, "Altaböke våtmark")], "en")
    expect(renamed).toEqual([
      expect.objectContaining({
        name: "Altaböke våtmark",
        line: "A wetland at Altaböke with a bird tower.",
      }),
    ])
  })

  it("leaves out a lokal that is gone or can't be shown on a map", () => {
    const sites = recommendedSites([lokal(3, "Altaböke sjö", { latitude: null })], "en")
    expect(sites).toEqual([])
  })

  it("has a line in both languages for every site", () => {
    for (const site of RECOMMENDED_SITES) {
      expect(site.line.en.length).toBeGreaterThan(0)
      expect(site.line.de.length).toBeGreaterThan(0)
    }
  })
})

describe("osmUrl", () => {
  it("puts a marker on the place, to about a metre", () => {
    expect(osmUrl(56.53301234, 13.642712)).toBe(
      "https://www.openstreetmap.org/?mlat=56.53301&mlon=13.64271#map=15/56.53301/13.64271"
    )
  })
})

describe("recentlyAlerted", () => {
  it("lists the active lokaler, newest alert first", () => {
    const list = recentlyAlerted([
      lokal(1, "A", { active: true, lastAlertAt: "2026-11-10T08:00:00Z" }),
      lokal(2, "B", { active: false, lastAlertAt: "2026-09-01T08:00:00Z" }),
      lokal(3, "C", { active: true, lastAlertAt: "2026-11-15T08:00:00Z" }),
      lokal(4, "D"),
    ])
    expect(list.map((one) => one.name)).toEqual(["C", "A"])
  })
})

describe("visitorPins", () => {
  it("drops the Swedish species names from the tooltips, and lokaler without a position", () => {
    const pins = visitorPins([
      lokal(1, "Klintbadet", { active: true, recentSpecies: ["Kungsfiskare"] }),
      lokal(2, "Okänd", { latitude: null, longitude: null }),
    ])
    expect(pins).toEqual([
      expect.objectContaining({ name: "Klintbadet", active: true, recentSpecies: [] }),
    ])
  })
})

describe("visitorDay", () => {
  const now = new Date("2026-11-17T10:00:00Z")

  it("says today and yesterday in the reader's language", () => {
    expect(visitorDay("2026-11-17T06:00:00Z", "en", now)).toBe("today")
    expect(visitorDay("2026-11-16T23:30:00Z", "de", now)).toBe("heute")
    expect(visitorDay("2026-11-16T06:00:00Z", "en", now)).toBe("yesterday")
    expect(visitorDay("2026-11-16T06:00:00Z", "de", now)).toBe("gestern")
  })

  it("writes other days as the reader would, never splitting the day from its month", () => {
    expect(visitorDay("2026-11-12T08:00:00Z", "en", now)).toBe("12 Nov")
    expect(visitorDay("2026-11-12T08:00:00Z", "de", now)).toBe("12. Nov.")
    expect(visitorDay("2025-11-12T08:00:00Z", "en", now)).toBe("12 Nov 2025")
  })
})

describe("visitorNumber", () => {
  it("groups digits as each language does", () => {
    expect(visitorNumber(12345, "en")).toBe("12,345")
    expect(visitorNumber(12345, "de")).toBe("12.345")
  })
})
