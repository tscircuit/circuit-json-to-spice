import { expect, test } from "bun:test"
import { formatSecondsForSpice } from "lib/processors/helpers"

test("formatSecondsForSpice formats common transient timing values", () => {
  expect(formatSecondsForSpice(0)).toBe("0")
  expect(formatSecondsForSpice(1e-9)).toBe("1n")
  expect(formatSecondsForSpice(1e-6)).toBe("1u")
  expect(formatSecondsForSpice(0.0005)).toBe("500u")
  expect(formatSecondsForSpice(0.001)).toBe("1m")
  expect(formatSecondsForSpice(0.002)).toBe("2m")
})

test("formatSecondsForSpice formats fractional engineering values when exact", () => {
  expect(formatSecondsForSpice(0.00071556)).toBe("715.56u")
})
