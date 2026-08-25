import { expect, test } from "bun:test"
import {
  formatSecondsForSpice,
  formatResistance,
  formatCapacitance,
  formatInductance,
} from "lib/processors/helpers"

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

test("formatResistance, formatCapacitance, formatInductance safely handle null, undefined, and non-finite values", () => {
  expect(formatResistance(null as any)).toBe("null")
  expect(formatResistance(undefined as any)).toBe("undefined")
  expect(formatResistance(Number.NaN)).toBe("NaN")
  expect(formatResistance(1000)).toBe("1K")

  expect(formatCapacitance(null as any)).toBe("null")
  expect(formatCapacitance(undefined as any)).toBe("undefined")
  expect(formatCapacitance(Number.NaN)).toBe("NaN")
  expect(formatCapacitance(1e-6)).toBe("1U")

  expect(formatInductance(null as any)).toBe("null")
  expect(formatInductance(undefined as any)).toBe("undefined")
  expect(formatInductance(Number.NaN)).toBe("NaN")
  expect(formatInductance(1e-3)).toBe("1m")
})
