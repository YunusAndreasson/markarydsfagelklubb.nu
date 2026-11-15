import { describe, expect, it } from "vitest"
import { encodeEntities, hideEmails } from "./email-hiding"

const decode = (html: string) =>
  html.replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))

describe("hideEmails", () => {
  const body =
    '<p>Skriv till <a href="mailto:kassor@markarydsfagelklubb.nu?subject=Hej">kassor@markarydsfagelklubb.nu</a> eller anna.andersson@example.se.</p>'

  it("leaves no address and no mailto: for a harvester to grep", () => {
    const hidden = hideEmails(body)
    expect(hidden).not.toMatch(/@|mailto:/i)
    expect(hidden).toContain("<a href=")
  })

  it("reads back exactly as before once a browser decodes the entities", () => {
    expect(decode(hideEmails(body))).toBe(body)
  })

  it("leaves HTML without addresses untouched", () => {
    const plain = '<p>Ring <a href="tel:+46433123">0433-123</a>.</p>'
    expect(hideEmails(plain)).toBe(plain)
  })

  it("encodes every character, å and all", () => {
    expect(encodeEntities("å@b")).toBe("&#229;&#64;&#98;")
  })
})
