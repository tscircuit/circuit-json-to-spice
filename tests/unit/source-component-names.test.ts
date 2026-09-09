import { expect, test } from "bun:test"
import type { SourceComponentBase } from "circuit-json"
import { allocateSourceComponentNames } from "lib/allocate-source-component-names"

const components = (
  names: string[],
  ftypes = names.map(() => "simple_resistor"),
): SourceComponentBase[] =>
  names.map((name, index) => ({
    type: "source_component",
    source_component_id: `component_${index}`,
    subcircuit_id: `module_${index}`,
    ftype: ftypes[index],
    name,
  }))

test("leaves unique names and input records unchanged", () => {
  const source = components(["R1", "R2", "R1_2"])
  const result = allocateSourceComponentNames(source)
  expect(result).toEqual(source)
  for (const [index, component] of source.entries()) {
    expect(result[index]).toBe(component)
  }
})

test("deduplicates names case-insensitively without mutating identities", () => {
  const source = components(["R1", "r1", "R1"])
  const original = structuredClone(source)
  const result = allocateSourceComponentNames(source)
  expect(result.map((component) => component.name)).toEqual([
    "R1",
    "r1_2",
    "R1_3",
  ])
  expect(source).toEqual(original)
  for (const [index, component] of result.entries()) {
    expect({ ...component, name: source[index].name }).toEqual(source[index])
  }
  expect(allocateSourceComponentNames(source)).toEqual(result)
})

test("preserves explicit suffixed names regardless of input position", () => {
  for (const names of [
    ["R1", "R1", "r1_2", "R1_3"],
    ["r1_2", "R1", "R1_3", "R1"],
  ]) {
    const result = allocateSourceComponentNames(components(names))
    expect(
      result.filter((component) => component.name === "R1_4"),
    ).toHaveLength(1)
    expect(result.find((component) => component.name === "r1_2")).toBeDefined()
    expect(result.find((component) => component.name === "R1_3")).toBeDefined()
    expect(
      new Set(result.map((component) => component.name.toLowerCase())).size,
    ).toBe(names.length)
  }
})

test.each([
  "simple_resistor",
  "simple_capacitor",
  "simple_inductor",
  "simple_diode",
  "simple_led",
  "simple_mosfet",
  "simple_transistor",
  "simple_switch",
])("deduplicates the %s namespace", (ftype) => {
  expect(
    allocateSourceComponentNames(
      components(["part", "PART"], [ftype, ftype]),
    ).map((component) => component.name),
  ).toEqual(["part", "PART_2"])
})

test("shares diode and LED namespaces but preserves different device prefixes", () => {
  const source = components(
    ["1", "1", "1", "1", "1", "1", "1"],
    [
      "simple_diode",
      "simple_led",
      "simple_resistor",
      "simple_capacitor",
      "simple_inductor",
      "simple_mosfet",
      "simple_transistor",
    ],
  )
  expect(
    allocateSourceComponentNames(source).map((component) => component.name),
  ).toEqual(["1", "1_2", "1", "1", "1", "1", "1"])
})

test("allocates after the switch processor's existing normalization", () => {
  const source = components(
    ["SW 1", "SW_1", "sw_1_2"],
    ["simple_switch", "simple_switch", "simple_switch"],
  )
  expect(
    allocateSourceComponentNames(source).map((component) => component.name),
  ).toEqual(["SW_1", "SW_1_3", "sw_1_2"])
})

test("does not allocate names for non-emitted source component types", () => {
  const source = components(["R1", "R1"], ["simple_chip", "simple_resistor"])
  expect(allocateSourceComponentNames(source)).toEqual(source)
})

test("switch suffixes cannot take voltage source or circuit node names", () => {
  const source = components(["SW1", "SW1"], ["simple_switch", "simple_switch"])
  const result = allocateSourceComponentNames(source, {
    reservedVoltageSourceNames: ["Vctrl_sw1_2"],
    reservedNodeNames: ["nctrl_sw1_3"],
  })
  expect(result.map((component) => component.name)).toEqual(["SW1", "SW1_4"])
})

test.each([
  { names: ["7", "SW_7"], expected: ["SW_7", "SW_7_2"] },
  { names: ["", "SW"], expected: ["SW", "SW_2"] },
])("reserves normalized switch bases for $names", ({ names, expected }) => {
  const source = components([...names], ["simple_switch", "simple_switch"])
  expect(
    allocateSourceComponentNames(source).map((component) => component.name),
  ).toEqual([...expected])
})
