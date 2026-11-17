/**
 * The site's languages (docs/design.md, "Besökare"). Every page is Swedish but
 * two: `/en` and `/de`, one page each for visitors, which the header links to
 * from every page. They are not translations of a Swedish page, so only they
 * name each other with hreflang.
 */

export type SiteLang = "sv" | "en" | "de"
export type VisitorLang = Exclude<SiteLang, "sv">

export type SiteLanguage<Code extends SiteLang = SiteLang> = {
  code: Code
  /** The language's name in itself, never in the page's language, and no flag. */
  label: string
  /** Swedish is the site itself, so its link is the home page. */
  href: string
}

export const VISITOR_LANGUAGES: readonly SiteLanguage<VisitorLang>[] = [
  { code: "en", label: "English", href: "/en" },
  { code: "de", label: "Deutsch", href: "/de" },
]

const SITE_LANGUAGES: readonly SiteLanguage[] = [
  { code: "sv", label: "Svenska", href: "/" },
  ...VISITOR_LANGUAGES,
]

/**
 * The languages a reader can switch to from a page in `current`, in one fixed
 * order: "English, Deutsch" on a Swedish page, "Svenska, Deutsch" on /en. The
 * Swedish convention ("In English" on a Swedish page, "På svenska" on an
 * English one), so the switch never needs a mark for where the reader is.
 */
export function otherLanguages(current: SiteLang): SiteLanguage[] {
  return SITE_LANGUAGES.filter((language) => language.code !== current)
}

const OG_LOCALES: Readonly<Record<SiteLang, string>> = { sv: "sv_SE", en: "en_GB", de: "de_DE" }

/** Open Graph's locale for a page's language: "en_GB", British English. */
export function ogLocale(lang: SiteLang): string {
  return OG_LOCALES[lang]
}

/** A page in another language, for `<link rel="alternate" hreflang>`. */
export type Alternate = { lang: SiteLang; href: string }

/** The visitor pages name each other, and themselves, as hreflang asks. */
export const VISITOR_ALTERNATES: readonly Alternate[] = VISITOR_LANGUAGES.map(({ code, href }) => ({
  lang: code,
  href,
}))
