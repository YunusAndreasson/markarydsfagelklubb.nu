import type { SiteLang, VisitorLang } from "./languages"
import { type LokalPin, type LokalSummary, toPin } from "./lokal"
import { startOfStockholmDay, stockholmYear, TIME_ZONE } from "./stockholm-time"

/**
 * The visitor pages, `/en` and `/de` (docs/design.md, "Besökare"): one page each
 * for someone in Markaryd who reads no Swedish. The rest of the site stays
 * Swedish; these two say so, and point into it where a map, a date or a
 * species' scientific name carries the meaning without the language.
 *
 * Everything they state comes from the club's own data (the Klubben page,
 * `locations.description`), the live data the pages read, or the club's own
 * answers (2026-11-17): visitors may write in Swedish, English or German, and
 * the pages promise nothing about guests on excursions.
 *
 * The copy for both languages is one typed object, so neither can lack a line
 * the other has.
 */

/**
 * A run of text, a link in it, or a scientific name (set in italics, as
 * everywhere on the site). A link to a Swedish page says so with `hreflang`.
 */
export type InlineLink = { text: string; href: string; hreflang?: SiteLang; external?: boolean }
export type Inline = string | InlineLink | { latin: string }
export type Paragraph = readonly Inline[]

export type GuideCopy = {
  /** For Intl: dates and numbers as the reader writes them. */
  locale: string
  title: string
  /** The meta description, what a search result shows. */
  description: string
  ingress: string
  map: { caption: string; fallback: string }
  sites: { title: string; lead: string; mapLink: string; elsewhere: string }
  alerts: {
    title: string
    lead: string
    empty: string
    all: string
    today: string
    yesterday: string
  }
  report: { title: string; paragraphs: readonly Paragraph[] }
  access: { title: string; paragraphs: readonly Paragraph[] }
  club: {
    title: string
    paragraphs: readonly Paragraph[]
    photoAlt: string
    photoCaption: string
    /** "Photo", before the photographer's name. */
    photoBy: string
    asideLabel: string
    contactLabel: string
    contactNote: string
    speciesLabel: string
    species: (count: string) => string
    speciesSource: string
  }
}

const ARTPORTALEN = "https://www.artportalen.se/"

export const GUIDE: Readonly<Record<VisitorLang, GuideCopy>> = {
  en: {
    locale: "en-GB",
    title: "Birdwatching in Markaryd",
    description:
      "Where to watch birds in Markaryd Municipality, Småland, Sweden: the bird club's sites on a map, recent bird alerts, and how to report what you see.",
    ingress:
      "Markaryds Fågelklubb is the bird club for Markaryd Municipality in south-west Småland, where the province meets Skåne and Halland. This page is for visitors: where to watch birds, where something has turned up lately, and how to reach us. The rest of the site is in Swedish.",
    map: {
      caption:
        "The club's birding sites in the municipality. A larger green dot means a bird alert was sent from there in the past two weeks.",
      fallback: "The map needs JavaScript. Four of the sites are listed below.",
    },
    sites: {
      title: "Where to watch birds",
      lead: "Four of the club's sites to start with. Each name leads to the site's own page, in Swedish, with a map and recent sightings.",
      mapLink: "On OpenStreetMap",
      elsewhere: "(another website)",
    },
    alerts: {
      title: "Recent bird alerts",
      lead: "When members find something worth seeing, they send an alert from the club's app. In the past two weeks, alerts came from these sites.",
      empty: "No alerts have come from the club's sites in the past two weeks.",
      all: "All bird alerts, in Swedish",
      today: "today",
      yesterday: "yesterday",
    },
    report: {
      title: "Report what you see",
      paragraphs: [
        [
          "Birds seen in Sweden are reported to ",
          { text: "Artportalen", href: ARTPORTALEN, external: true },
          ", the national species observation system, which can be switched to English. What you report in the municipality counts in ",
          { text: "the club's statistics", href: "/obsar", hreflang: "sv" },
          " on this site.",
        ],
        [
          "Artportalen keeps sightings of protected species out of public view, so you can report a nest without giving it away.",
        ],
      ],
    },
    access: {
      title: "Out in nature",
      paragraphs: [
        [
          "Sweden's right of public access, allemansrätten, lets you walk almost anywhere in the countryside, as long as you don't disturb and don't destroy. For birdwatchers that means keeping your distance from nests and young birds, and following the signs: some bird sanctuaries are closed to visitors in the breeding season.",
        ],
        [
          "The Swedish Environmental Protection Agency explains ",
          {
            text: "the right of public access in English",
            href: "https://www.naturvardsverket.se/en/topics/the-right-of-public-access",
            external: true,
          },
          ".",
        ],
      ],
    },
    club: {
      title: "The club",
      paragraphs: [
        [
          "Markaryds Fågelklubb was founded in 1986 and has about 90 members. Its emblem is the White-throated Dipper, ",
          { latin: "Cinclus cinclus" },
          ", and the programme booklet that comes out each January is named after it.",
        ],
        [
          "We run excursions, indoor meetings with slide shows, courses, bird counts and bird protection work. ",
          { text: "The programme", href: "/kalender", hreflang: "sv" },
          " is in Swedish.",
        ],
        [
          "Questions about birds or birdwatching in the area? Write to us in English, German or Swedish.",
        ],
      ],
      photoAlt: "A White-throated Dipper on a mossy stone by rushing water.",
      photoCaption: "The White-throated Dipper, the club's emblem bird.",
      photoBy: "Photo",
      asideLabel: "About the club",
      contactLabel: "Contact",
      contactNote: "In English, German or Swedish.",
      speciesLabel: "Recorded here",
      species: (count) => `${count} bird species`,
      speciesSource: "reported in the municipality to Artportalen",
    },
  },
  de: {
    locale: "de-DE",
    title: "Vogelbeobachtung in Markaryd",
    description:
      "Wo Sie in der Gemeinde Markaryd in Småland, Schweden, Vögel beobachten können: die Beobachtungsplätze des Vogelvereins auf einer Karte, aktuelle Vogelmeldungen und wie Sie Ihre Beobachtungen melden.",
    ingress:
      "Markaryds Fågelklubb ist der Vogelverein der Gemeinde Markaryd im Südwesten Smålands, wo die Provinz an Schonen und Halland grenzt. Diese Seite ist für Gäste: wo Sie Vögel beobachten können, wo zuletzt etwas aufgetaucht ist und wie Sie uns erreichen. Der Rest der Website ist auf Schwedisch.",
    map: {
      caption:
        "Die Beobachtungsplätze des Vereins in der Gemeinde. Ein größerer grüner Punkt bedeutet, dass von dort in den letzten zwei Wochen eine Vogelmeldung kam.",
      fallback: "Die Karte braucht JavaScript. Vier der Plätze stehen unten.",
    },
    sites: {
      title: "Wo Sie Vögel beobachten können",
      lead: "Vier Plätze des Vereins für den Anfang. Jeder Name führt zur Seite des Platzes, auf Schwedisch, mit Karte und den neuesten Beobachtungen.",
      mapLink: "Auf OpenStreetMap",
      elsewhere: "(andere Website)",
    },
    alerts: {
      title: "Aktuelle Vogelmeldungen",
      lead: "Wenn Mitglieder etwas Sehenswertes entdecken, melden sie es über die App des Vereins. In den letzten zwei Wochen kamen Meldungen von diesen Plätzen.",
      empty: "In den letzten zwei Wochen kamen keine Meldungen von den Plätzen des Vereins.",
      all: "Alle Vogelmeldungen, auf Schwedisch",
      today: "heute",
      yesterday: "gestern",
    },
    report: {
      title: "Beobachtungen melden",
      paragraphs: [
        [
          "Vogelbeobachtungen in Schweden werden an ",
          { text: "Artportalen", href: ARTPORTALEN, external: true },
          " gemeldet, das nationale Meldeportal für Artenbeobachtungen. Es lässt sich auf Englisch umstellen, eine deutsche Fassung gibt es nicht. Was Sie in der Gemeinde melden, fließt in ",
          { text: "die Statistik des Vereins", href: "/obsar", hreflang: "sv" },
          " auf dieser Website ein.",
        ],
        [
          "Beobachtungen geschützter Arten hält Artportalen vor der Öffentlichkeit verborgen. So können Sie auch ein Nest melden, ohne es preiszugeben.",
        ],
      ],
    },
    access: {
      title: "Unterwegs in der Natur",
      paragraphs: [
        [
          "Das schwedische Jedermannsrecht, allemansrätten, erlaubt Ihnen, sich fast überall in der Natur frei zu bewegen, solange Sie nichts stören und nichts zerstören. Für Vogelbeobachter heißt das: Abstand halten zu Nestern und Jungvögeln und auf Schilder achten, denn manche Vogelschutzgebiete sind während der Brutzeit gesperrt.",
        ],
        [
          "Das schwedische Naturschutzamt erklärt die Regeln in seinem ",
          {
            text: "Handbuch zum Jedermannsrecht (PDF, auf Deutsch)",
            href: "https://www.naturvardsverket.se/496eca/globalassets/vagledning/allemansratten/manga-sprak/handboken-allemansratten-tyska.pdf",
            external: true,
          },
          ".",
        ],
      ],
    },
    club: {
      title: "Der Verein",
      paragraphs: [
        [
          "Markaryds Fågelklubb wurde 1986 gegründet und hat rund 90 Mitglieder. Wappenvogel des Vereins ist die Wasseramsel, ",
          { latin: "Cinclus cinclus" },
          ". Nach ihr ist auch das Programmheft benannt, das jedes Jahr im Januar erscheint.",
        ],
        [
          "Wir veranstalten Exkursionen, Treffen mit Bildvorträgen, Kurse, Vogelzählungen und praktischen Vogelschutz. ",
          { text: "Das Programm", href: "/kalender", hreflang: "sv" },
          " gibt es nur auf Schwedisch.",
        ],
        [
          "Fragen zu Vögeln oder zur Vogelbeobachtung in der Gegend? Schreiben Sie uns gern auf Deutsch, Englisch oder Schwedisch.",
        ],
      ],
      photoAlt: "Eine Wasseramsel auf einem bemoosten Stein an rauschendem Wasser.",
      photoCaption: "Die Wasseramsel, der Wappenvogel des Vereins.",
      photoBy: "Foto",
      asideLabel: "Über den Verein",
      contactLabel: "Kontakt",
      contactNote: "Auf Deutsch, Englisch oder Schwedisch.",
      speciesLabel: "Hier beobachtet",
      species: (count) => `${count} Vogelarten`,
      speciesSource: "in der Gemeinde an Artportalen gemeldet",
    },
  },
}

/**
 * The four lokaler the pages recommend, by `locations.id`: the ones with a
 * description in the club's data (2026-11-17). Each line translates that
 * description, so a change to it in the app wants a change here. By id, not by
 * name, since a lokal can be renamed in the app.
 */
export const RECOMMENDED_SITES: readonly { id: number; line: Record<VisitorLang, string> }[] = [
  {
    id: 3, // Altaböke sjö
    line: {
      en: "A wetland at Altaböke with a bird tower.",
      de: "Ein Feuchtgebiet bei Altaböke mit Vogelturm.",
    },
  },
  {
    id: 2, // Lokasjöområdet
    line: {
      en: "A lake area south-west of Markaryd, popular for days out, with several birding spots.",
      de: "Ein Seengebiet südwestlich von Markaryd, beliebtes Ausflugsziel mit mehreren Beobachtungsplätzen.",
    },
  },
  {
    id: 7, // Köphultasjön
    line: {
      en: "A lake in woodland, with a trail all the way round.",
      de: "Ein See im Wald, mit einem Wanderweg rundherum.",
    },
  },
  {
    id: 8, // Skararps ängar
    line: {
      en: "Open grassland and meadows with grazed shores.",
      de: "Offenes Grasland und Wiesen mit beweideten Ufern.",
    },
  },
]

export type RecommendedSite = {
  slug: string
  name: string
  line: string
  mapUrl: string
}

/** A place on OpenStreetMap, with its marker. Five decimals is about a metre. */
export function osmUrl(latitude: number, longitude: number): string {
  const lat = latitude.toFixed(5)
  const lon = longitude.toFixed(5)
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`
}

/**
 * The recommended sites the app still has, in the order above. One that is
 * gone, or has no position to show, is left out rather than linked to nothing.
 */
export function recommendedSites(
  lokaler: readonly LokalSummary[],
  lang: VisitorLang
): RecommendedSite[] {
  const byId = new Map(lokaler.map((lokal) => [lokal.id, lokal]))
  return RECOMMENDED_SITES.flatMap(({ id, line }) => {
    const lokal = byId.get(id)
    if (!lokal || lokal.latitude === null || lokal.longitude === null) return []
    return [
      {
        slug: lokal.slug,
        name: lokal.name,
        line: line[lang],
        mapUrl: osmUrl(lokal.latitude, lokal.longitude),
      },
    ]
  })
}

/** The lokaler alerted from in the past two weeks, newest first, as /lokaler lists them. */
export function recentlyAlerted(
  lokaler: readonly LokalSummary[]
): (LokalSummary & { lastAlertAt: string })[] {
  return lokaler
    .filter((lokal): lokal is LokalSummary & { lastAlertAt: string } =>
      Boolean(lokal.active && lokal.lastAlertAt)
    )
    .sort((a, b) => (a.lastAlertAt < b.lastAlertAt ? 1 : a.lastAlertAt > b.lastAlertAt ? -1 : 0))
}

/**
 * The map's pins without the birds' names: the tooltip's "Nyss: kungsfiskare"
 * is Swedish, and a visitor gets the place's name alone.
 */
export function visitorPins(lokaler: readonly LokalSummary[]): LokalPin[] {
  return lokaler.flatMap((lokal) => {
    const pin = toPin(lokal)
    return pin ? [{ ...pin, recentSpecies: [] }] : []
  })
}

const SHORT_DAY: Record<VisitorLang, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "short" }),
  de: new Intl.DateTimeFormat("de-DE", { timeZone: TIME_ZONE, day: "numeric", month: "short" }),
}

/**
 * When, as the reader would say it: "today", "yesterday", else "12 Nov" or
 * "12. Nov.", with the year when it isn't this one. Days are Stockholm's, as
 * everywhere on the site (`stockholm-time.ts`).
 */
export function visitorDay(
  value: Date | string,
  lang: VisitorLang,
  now: Date = new Date()
): string {
  const copy = GUIDE[lang].alerts
  const day = startOfStockholmDay(value).getTime()
  const today = startOfStockholmDay(now).getTime()
  if (day === today) return copy.today
  if (day === startOfStockholmDay(new Date(today - 12 * 3_600_000)).getTime()) return copy.yesterday
  const short = SHORT_DAY[lang].format(new Date(value)).replace(/(\d\.?) (?=\p{L})/u, "$1 ")
  const year = stockholmYear(value)
  return year === stockholmYear(now) ? short : `${short} ${year}`
}

/** A count as the reader writes it: "1,234" in English, "1.234" in German. */
export function visitorNumber(count: number, lang: VisitorLang): string {
  return count.toLocaleString(GUIDE[lang].locale)
}
