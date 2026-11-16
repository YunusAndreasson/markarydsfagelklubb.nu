/**
 * A Swedish phone number written the way Svenska skrivregler and PTS write it:
 * the area code, a hyphen, then the number in groups from the right, with a
 * group of three first when the count is odd. "0706 -224503", "070-6224503" and
 * "0706-224503" all read "070-622 45 03".
 *
 * The area code is the hard part: it is two to four digits and only a table of
 * every one of them would say which. So it is decided only where that is safe:
 * a mobile number (07x, ten digits) and Stockholm (08) are known; any other
 * number keeps the area code its writer marked with a hyphen or space, and a
 * number with nothing marked is left exactly as written.
 */
export function formatPhone(raw: string): string {
  const written = raw.trim()
  if (written.startsWith("+")) return written
  const digits = written.replace(/\D/g, "")
  if (!digits.startsWith("0")) return written

  let area: string
  if (/^07\d{8}$/.test(digits)) area = digits.slice(0, 3)
  else if (/^08\d{5,8}$/.test(digits)) area = "08"
  else {
    const marked = written.match(/^(0\d{1,3})[\s ]*[-–—\s ][\s ]*\d/)?.[1]
    if (!marked) return written
    area = marked
  }

  const rest = digits.slice(area.length)
  const grouped = groupDigits(rest)
  return grouped ? `${area}-${grouped}` : written
}

/** "6224503" → "622 45 03"; null for a count no Swedish number has. */
function groupDigits(rest: string): string | null {
  switch (rest.length) {
    case 5:
      return `${rest.slice(0, 3)} ${rest.slice(3)}`
    case 6:
      return `${rest.slice(0, 2)} ${rest.slice(2, 4)} ${rest.slice(4)}`
    case 7:
      return `${rest.slice(0, 3)} ${rest.slice(3, 5)} ${rest.slice(5)}`
    case 8:
      return `${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`
    default:
      return null
  }
}
