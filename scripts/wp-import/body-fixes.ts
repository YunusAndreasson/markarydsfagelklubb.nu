/**
 * Mistakes in the WordPress bodies that no rule can repair, keyed by WordPress
 * post id: the text as stored after sanitizing, and what it should say. Without
 * this list a re-import would bring them back. What changed:
 *
 * - an address linked as a page or a host, which goes nowhere;
 * - 9289: "ö" can't occur in a Gmail address and the right spelling isn't known,
 *   so the address stays readable but is no longer a link;
 * - 3937: the link's text names the SOF's site, the href was its mailbox;
 * - a doubled word.
 */
export const BODY_FIXES: Readonly<Record<number, readonly (readonly [string, string])[]>> = {
  3937: [['href="http://info@birdlife.se"', 'href="https://birdlife.se"']],
  8849: [
    [
      'href="/kontakta-oss-2/sveneric.helmersson@telia.com"',
      'href="mailto:sveneric.helmersson@telia.com"',
    ],
  ],
  9289: [
    [
      '<a href="http://annette.m.hellstr%C3%B6m@gmail.com/">annette.m.hellström@gmail.com</a>',
      "annette.m.hellström@gmail.com",
    ],
  ],
  10340: [["Vi kan kan också", "Vi kan också"]],
}

/** Applies a post's fixes. A fix that no longer matches is returned, not ignored. */
export function applyBodyFixes(
  wpId: number,
  html: string
): { html: string; unmatched: readonly string[] } {
  let fixed = html
  const unmatched: string[] = []
  for (const [from, to] of BODY_FIXES[wpId] ?? []) {
    if (fixed.includes(from)) fixed = fixed.replace(from, to)
    else if (!fixed.includes(to)) unmatched.push(from)
  }
  return { html: fixed, unmatched }
}
