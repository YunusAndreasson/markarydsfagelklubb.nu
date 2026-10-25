import { describe, expect, it } from "vitest"
import { captionStoredPhotos, tidyLineBreaks } from "./tidy"

// Lines from the club's own posts (articles 35, 40 and 550 on the old site).

describe("tidyLineBreaks", () => {
  it("makes each prose line a paragraph and keeps a run of short lines together", () => {
    expect(
      tidyLineBreaks(
        "<p>Samling kl. 08.00 vid Röda ladan. Vi avslutar räkningen normalt vid lunchtid. <br />Förhoppningsvis kan det också rasta något spännande på ängarna.<br />Medtag gärna fika!<br />Ledare: Anna Andersson, 070-174 06 05.<br />Välkomna!</p>"
      )
    ).toBe(
      "<p>Samling kl. 08.00 vid Röda ladan. Vi avslutar räkningen normalt vid lunchtid.</p>" +
        "<p>Förhoppningsvis kan det också rasta något spännande på ängarna.</p>" +
        "<p>Medtag gärna fika!<br />Ledare: Anna Andersson, 070-174 06 05.<br />Välkomna!</p>"
    )
  })

  it("joins a line broken in the middle of a sentence", () => {
    expect(
      tidyLineBreaks(
        "<p>Nästa stopp vid stora kalhygget i Örnafälla behövde<br />vi inte vänta länge, förrän en nattskärra började att spela intensivt, <br />med sitt spinnande läte.</p>"
      )
    ).toBe(
      "<p>Nästa stopp vid stora kalhygget i Örnafälla behövde vi inte vänta länge, förrän en nattskärra började att spela intensivt, med sitt spinnande läte.</p>"
    )
  })

  it("turns lines typed with a bullet into a list, a wrapped item into one item", () => {
    expect(
      tidyLineBreaks(
        "<p><strong>Redovisning i punktform;</strong><br />\n• Ekonomin är god.<br />\n• Nils-Evert skriver en fågelårsrapport till vårnumret av<br />\nCinclus.<br />\n• Fågelresa i februari.</p>"
      )
    ).toBe(
      "<p><strong>Redovisning i punktform;</strong></p>" +
        "<ul><li><p>Ekonomin är god.</p></li><li><p>Nils-Evert skriver en fågelårsrapport till vårnumret av Cinclus.</p></li><li><p>Fågelresa i februari.</p></li></ul>"
    )
  })

  it("keeps a bold line apart from the text under it", () => {
    expect(
      tidyLineBreaks(
        "<p><strong>Onsdag 28 oktober kl. 18:30 – Inför Smålandsrallyt och medlemsbilder</strong><br />Taktiksnack i klubblokalen kl. 18:30 inför Smålandsrallyt den 31/10.</p>"
      )
    ).toBe(
      "<p><strong>Onsdag 28 oktober kl. 18:30 – Inför Smålandsrallyt och medlemsbilder</strong></p>" +
        "<p>Taktiksnack i klubblokalen kl. 18:30 inför Smålandsrallyt den 31/10.</p>"
    )
  })

  it("keeps an e-mail address on its own line", () => {
    const contact = "<p>Per Persson, 070-174 06 08<br />per.persson@example.se</p>"
    expect(tidyLineBreaks(contact)).toBe(contact)
  })

  it("leaves a list of short lines alone", () => {
    const species = "<p>Sädgås 12<br />storlom 2<br />fiskgjuse 1<br />havsörn 3</p>"
    expect(tidyLineBreaks(species)).toBe(species)
  })

  it("leaves breaks in captions, list items, cells and quotes, and paragraphs with a photo", () => {
    const html =
      '<figure><img src="x" /><figcaption>Ägretthäger. En utmaning, att jobba på!<br />Foto: Nils-Evert Gustafsson.</figcaption></figure>' +
      "<ul><li><p>En lång rad som skulle bli ett eget stycke om den stod fritt.<br />Och en till lång rad som också skulle det.</p></li></ul>" +
      "<blockquote><p>En lång rad som skulle bli ett eget stycke om den stod fritt.<br />Och en till lång rad.</p></blockquote>" +
      '<p><img src="x" /><br />En lång rad som skulle bli ett eget stycke om den stod fritt.</p>'
    expect(tidyLineBreaks(html)).toBe(html)
  })

  it("never splits inside a bold or a link", () => {
    const html =
      "<p><strong>En lång fet rad som skulle bli ett eget stycke om den stod fritt.<br />Och en till lång rad i samma fetstil.</strong></p>"
    expect(tidyLineBreaks(html)).toBe(html)
  })

  it("drops empty lines and breaks at a paragraph's edges", () => {
    expect(tidyLineBreaks("<p><br />Följ med ut i sommarnatten.<br /> <br /></p>")).toBe(
      "<p>Följ med ut i sommarnatten.</p>"
    )
  })
})

describe("captionStoredPhotos", () => {
  const img = '<img src="https://example.test/a.webp" alt="" />'

  it("puts a WordPress caption back into a figure with its photo", () => {
    const { html, captioned } = captionStoredPhotos(
      `${img}<p><em> Röd glada (Milvus milvus). Foto. Olof Bergqvist.</em></p><p>Text.</p>`,
      ["<em>&nbsp;Röd glada (Milvus milvus). Foto. Olof Bergqvist.</em>"]
    )
    expect(captioned).toBe(1)
    expect(html).toBe(
      `<figure>${img}<figcaption><em> Röd glada (Milvus milvus). Foto. Olof Bergqvist.</em></figcaption></figure><p>Text.</p>`
    )
  })

  it("leaves a paragraph after a photo alone unless it was a caption, and uses each caption once", () => {
    const html = `${img}<p>Reningsdammarna. Foto: Lars.</p>${img}<p>Reningsdammarna. Foto: Lars.</p>${img}<p>Kvällen var räddad!</p>`
    const { html: out, captioned } = captionStoredPhotos(html, ["Reningsdammarna. Foto: Lars."])
    expect(captioned).toBe(1)
    expect(out).toBe(
      `<figure>${img}<figcaption>Reningsdammarna. Foto: Lars.</figcaption></figure>${img}<p>Reningsdammarna. Foto: Lars.</p>${img}<p>Kvällen var räddad!</p>`
    )
  })
})
