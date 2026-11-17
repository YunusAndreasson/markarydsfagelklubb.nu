import { describe, expect, it } from "vitest"
import { buildPageTree, type PageRow } from "./page-tree"
import { renderSitemap, type SitemapSources, sitemapEntries } from "./sitemap"

const row = (
  id: number,
  slug: string,
  parent_id: number | null = null,
  kind: PageRow["kind"] = "page"
): PageRow => ({
  id,
  parent_id,
  kind,
  slug,
  title: slug,
  link_url: kind === "link" ? "https://example.test" : null,
  show_in_menu: true,
  sort_order: id,
})

const sources = (overrides: Partial<SitemapSources> = {}): SitemapSources => ({
  tree: buildPageTree([
    row(1, "om-foreningen"),
    row(2, "medlemskap", 1),
    row(3, "styrelsen", 1),
    row(4, "facebook", 1, "link"),
    row(5, "obsar"),
    row(6, "gammal", 99),
  ]),
  pageUpdatedAt: new Map([
    [1, "2026-10-24T10:00:00+00:00"],
    [2, "2026-10-24T10:00:00+00:00"],
    [3, "2026-11-01T08:30:00.123456+00:00"],
  ]),
  articles: [
    {
      slug: "ny-hackfagel",
      published_at: "2025-06-23T04:39:37+00:00",
      updated_at: "2025-06-24T10:00:00+00:00",
      category_id: 1,
    },
    {
      slug: "nyarsrapport",
      // New Year's Eve in UTC is already New Year's Day in Markaryd.
      published_at: "2025-12-31T23:30:00+00:00",
      updated_at: "2026-01-01T00:00:00+00:00",
      category_id: null,
    },
  ],
  categories: [
    { id: 1, slug: "referat" },
    { id: 2, slug: "tom" },
  ],
  events: [{ slug: "varfagelskadning", updated_at: "2026-03-01T12:00:00+00:00" }],
  lokalSlugs: ["hualtet"],
  speciesSlugs: ["stare"],
  obsarYears: [2026, 2024, 2025],
  now: new Date("2026-11-15T12:00:00Z"),
  ...overrides,
})

const paths = (s: SitemapSources) => sitemapEntries(s).map((entry) => entry.path)

describe("sitemapEntries", () => {
  it("lists every public page type once", () => {
    expect(paths(sources())).toEqual([
      "/",
      "/artiklar",
      "/larm",
      "/kalender",
      "/obsar",
      "/obsar/senaste",
      "/obsar/arslista",
      "/obsar/markarydslistan",
      "/obsar/ligan",
      "/obsar/40-ar",
      "/lokaler",
      "/om-foreningen/anvandarvillkor-markaryds-fagelklubb-appen",
      "/om-foreningen/integritetspolicy-markaryds-fagelklubb-appen",
      "/en",
      "/de",
      "/om-foreningen",
      "/om-foreningen/medlemskap",
      "/om-foreningen/styrelsen",
      "/artiklar/ny-hackfagel",
      "/artiklar/nyarsrapport",
      "/artiklar/kategori/referat",
      "/artiklar/ar/2026",
      "/artiklar/ar/2025",
      "/kalender/varfagelskadning",
      "/lokaler/hualtet",
      "/arter/stare",
      "/obsar/arslista/2025",
      "/obsar/arslista/2024",
      "/obsar/ligan/2025",
      "/obsar/ligan/2024",
    ])
  })

  it("leaves out links, orphans, admin, larm and month pages", () => {
    const listed = paths(sources())
    expect(listed).not.toContain("/om-foreningen/facebook")
    expect(listed).not.toContain("/gammal")
    expect(listed.some((path) => path.startsWith("/admin"))).toBe(false)
    expect(listed.some((path) => path.startsWith("/larm/"))).toBe(false)
    expect(listed.some((path) => /^\/kalender\/\d{4}-\d{2}$/.test(path))).toBe(false)
  })

  it("dates only rows that say when they changed, and not pages with live data", () => {
    const lastmod = new Map(sitemapEntries(sources()).map((entry) => [entry.path, entry.lastmod]))
    expect(lastmod.get("/")).toBeNull()
    expect(lastmod.get("/om-foreningen")).toBeNull()
    expect(lastmod.get("/om-foreningen/medlemskap")).toBeNull()
    expect(lastmod.get("/om-foreningen/styrelsen")).toBe("2026-11-01T08:30:00.123Z")
    expect(lastmod.get("/artiklar/ny-hackfagel")).toBe("2025-06-24T10:00:00.000Z")
    expect(lastmod.get("/kalender/varfagelskadning")).toBe("2026-03-01T12:00:00.000Z")
    expect(lastmod.get("/artiklar/kategori/referat")).toBeNull()
    expect(lastmod.get("/arter/stare")).toBeNull()
  })
})

describe("renderSitemap", () => {
  it("writes absolute apex URLs, with lastmod only where there is one", () => {
    const xml = renderSitemap("https://markarydsfagelklubb.nu", [
      { path: "/", lastmod: null },
      { path: "/artiklar/a&b", lastmod: "2026-11-01T08:30:00.000Z" },
    ])
    expect(xml).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        "<url><loc>https://markarydsfagelklubb.nu/</loc></url>",
        "<url><loc>https://markarydsfagelklubb.nu/artiklar/a&amp;b</loc>" +
          "<lastmod>2026-11-01T08:30:00.000Z</lastmod></url>",
        "</urlset>",
      ].join("\n")
    )
  })
})
