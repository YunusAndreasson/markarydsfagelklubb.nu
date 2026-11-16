import { describe, expect, it } from "vitest"
import { formatPhone } from "./phone"

describe("formatPhone", () => {
  it("writes a mobile number with a three-digit area code, whatever the input", () => {
    expect(formatPhone("0706 -224503")).toBe("070-622 45 03")
    expect(formatPhone("070-6224503")).toBe("070-622 45 03")
    expect(formatPhone("0706-224503")).toBe("070-622 45 03")
    expect(formatPhone("0705-94 31 07")).toBe("070-594 31 07")
    expect(formatPhone("070-174 06 50")).toBe("070-174 06 50")
    expect(formatPhone("0701740650")).toBe("070-174 06 50")
  })

  it("knows Stockholm's 08", () => {
    expect(formatPhone("08 12345678")).toBe("08-123 456 78")
    expect(formatPhone("081234567")).toBe("08-123 45 67")
  })

  it("keeps a landline's area code as its writer marked it", () => {
    expect(formatPhone("0433-12345")).toBe("0433-123 45")
    expect(formatPhone("0433 123456")).toBe("0433-12 34 56")
    expect(formatPhone("0372–1234567")).toBe("0372-123 45 67")
  })

  it("leaves a number alone when the area code can't be told", () => {
    expect(formatPhone("0433123456")).toBe("0433123456")
    expect(formatPhone(" +46 70 174 06 50 ")).toBe("+46 70 174 06 50")
    expect(formatPhone("5661-4969")).toBe("5661-4969")
    expect(formatPhone("0433-12")).toBe("0433-12")
  })
})
