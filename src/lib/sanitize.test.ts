import { describe, expect, it } from "vitest"

import { SITE_MEDIA_PUBLIC_PREFIX } from "./media"
import { sanitizeContent } from "./sanitize"

const IMG = `${SITE_MEDIA_PUBLIC_PREFIX}2026/09/11111111-1111-1111-1111-111111111111`

describe("sanitizeContent: what gets removed", () => {
  it("drops scripts, styles and their contents", () => {
    expect(sanitizeContent("<p>Hej</p><script>alert(1)</script><style>p{}</style>")).toBe(
      "<p>Hej</p>"
    )
  })

  it("drops event handlers, classes and inline styles", () => {
    expect(
      sanitizeContent(
        '<p onclick="x()" class="big" style="color:red">Hej <strong onmouseover="y()">du</strong></p>'
      )
    ).toBe("<p>Hej <strong>du</strong></p>")
  })

  it("never keeps a javascript: or data: link", () => {
    for (const href of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      " javascript:alert(1)",
      "data:text/html,x",
      "vbscript:x",
    ]) {
      expect(sanitizeContent(`<a href="${href}">x</a>`), href).toBe("<a>x</a>")
    }
  })

  it("never keeps a protocol-relative link", () => {
    expect(sanitizeContent('<a href="//evil.example/">x</a>')).toBe("<a>x</a>")
  })

  it("removes images that are not in the site-media bucket", () => {
    expect(sanitizeContent('<p>a<img src="https://evil.example/pixel.gif" />b</p>')).toBe(
      "<p>ab</p>"
    )
    expect(sanitizeContent('<img src="http://zgnmajovyqibgxlcomvb.supabase.co/x.webp" />')).toBe("")
    expect(sanitizeContent(`<img src="${SITE_MEDIA_PUBLIC_PREFIX}../user-uploads/x.jpg" />`)).toBe(
      ""
    )
  })

  it("removes an image when any srcset candidate is foreign", () => {
    const srcset = `${IMG}/480.webp 480w, https://evil.example/x.webp 960w`
    expect(sanitizeContent(`<img src="${IMG}/960.webp" srcset="${srcset}" />`)).toBe("")
  })

  it("removes iframes from anywhere but the embed sources", () => {
    expect(sanitizeContent('<iframe src="https://evil.example/"></iframe>')).toBe("")
    expect(sanitizeContent('<iframe src="https://www.google.com/"></iframe>')).toBe("")
    expect(sanitizeContent('<iframe srcdoc="<script>x</script>"></iframe>')).toBe("")
  })

  it("keeps the text of tags outside the allowlist", () => {
    expect(
      sanitizeContent("<h1>Rubrik</h1><div><span>Text</span></div><pre><code>x</code></pre>")
    ).toBe("RubrikTextx")
  })

  it("forces rel=noopener on links that open a new tab, and drops other targets", () => {
    expect(sanitizeContent('<a href="https://x.se" target="_blank">x</a>')).toBe(
      '<a href="https://x.se" target="_blank" rel="noopener noreferrer">x</a>'
    )
    expect(sanitizeContent('<a href="https://x.se" target="_parent">x</a>')).toBe(
      '<a href="https://x.se">x</a>'
    )
  })
})

describe("sanitizeContent: what survives", () => {
  it("keeps the editor's text structure", () => {
    const html =
      "<h2>Rubrik</h2><p>Med <strong>fet</strong>, <em>Cinclus cinclus</em>, <s>struken</s> och <u>understruken</u> text.<br />Ny rad.</p>" +
      '<ul><li><p>Ett</p></li></ul><ol start="3"><li><p>Tre</p></li></ol><blockquote><p>Citat</p></blockquote><hr />'
    expect(sanitizeContent(html)).toBe(html)
  })

  it("keeps links with the schemes members use", () => {
    const html =
      '<p><a href="https://www.artportalen.se/">A</a> <a href="mailto:webmaster@markarydsfagelklubb.nu">B</a> <a href="tel:+46433123">C</a> <a href="/artiklar">D</a></p>'
    expect(sanitizeContent(html)).toBe(html)
  })

  it("keeps site-media images with srcset and dimensions, lazy by default", () => {
    const srcset = `${IMG}/480.webp 480w, ${IMG}/960.webp 960w, ${IMG}/1600.webp 1600w`
    const html = `<img src="${IMG}/960.webp" srcset="${srcset}" sizes="(min-width: 40rem) 38rem, 100vw" width="1600" height="1067" alt="Strömstare vid Lagan" />`
    expect(sanitizeContent(html)).toBe(html.replace(" />", ' loading="lazy" />'))
  })

  it("keeps allowed embeds and makes them lazy", () => {
    expect(
      sanitizeContent(
        '<iframe src="https://www.google.com/maps/embed?pb=!1m18" title="Karta" width="600" style="border:0"></iframe>'
      )
    ).toBe(
      '<iframe src="https://www.google.com/maps/embed?pb=!1m18" title="Karta" loading="lazy"></iframe>'
    )
  })

  it("keeps tables and their spans", () => {
    const html =
      '<table><tbody><tr><th colspan="1" rowspan="1"><p>Datum</p></th><th colspan="2" rowspan="1"><p>Aktivitet</p></th></tr><tr><td colspan="1" rowspan="1"><p>21 feb</p></td><td colspan="2" rowspan="1"><p>Ugglespaning</p></td></tr></tbody></table>'
    expect(sanitizeContent(html)).toBe(html)
  })

  it("escapes rather than executes text that looks like markup", () => {
    expect(sanitizeContent("<p>1 &lt; 2 &amp; 3 &gt; 2</p>")).toBe("<p>1 &lt; 2 &amp; 3 &gt; 2</p>")
  })
})
