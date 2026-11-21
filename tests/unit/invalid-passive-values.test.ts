import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

type PassiveFixture = {
  type: "source_component"
  source_component_id: string
  name: string
  ftype: "simple_resistor" | "simple_capacitor" | "simple_inductor"
  resistance?: unknown
  capacitance?: unknown
  inductance?: unknown
}

const makeComponent = (
  name: string,
  ftype: PassiveFixture["ftype"],
  field: "resistance" | "capacitance" | "inductance",
  value: unknown,
  includeValue = true,
): PassiveFixture => ({
  type: "source_component",
  source_component_id: name,
  name,
  ftype,
  ...(includeValue ? { [field]: value } : {}),
})

const makeCircuit = (components: PassiveFixture[]): AnyCircuitElement[] =>
  components.flatMap((component) => [
    component,
    {
      type: "source_port",
      source_port_id: `${component.name}_pin1`,
      source_component_id: component.source_component_id,
      name: "pin1",
      pin_number: 1,
    },
    {
      type: "source_port",
      source_port_id: `${component.name}_pin2`,
      source_component_id: component.source_component_id,
      name: "pin2",
      pin_number: 2,
    },
  ]) as AnyCircuitElement[]

const passiveTypes = [
  { ftype: "simple_resistor", field: "resistance" },
  { ftype: "simple_capacitor", field: "capacitance" },
  { ftype: "simple_inductor", field: "inductance" },
] as const

const invalidValues = [
  { label: "missing", value: undefined, includeValue: false },
  { label: "undefined", value: undefined, includeValue: true },
  { label: "null", value: null, includeValue: true },
  { label: "NaN", value: Number.NaN, includeValue: true },
  {
    label: "positive infinity",
    value: Number.POSITIVE_INFINITY,
    includeValue: true,
  },
  {
    label: "negative infinity",
    value: Number.NEGATIVE_INFINITY,
    includeValue: true,
  },
] as const

for (const { ftype, field } of passiveTypes) {
  for (const { label, value, includeValue } of invalidValues) {
    test(`conversion skips ${ftype} with ${label} ${field} before and between valid components`, () => {
      const circuitJson = makeCircuit([
        makeComponent("BAD_BEFORE", ftype, field, value, includeValue),
        makeComponent("GOOD_R", "simple_resistor", "resistance", 1000),
        makeComponent("BAD_BETWEEN", ftype, field, value, includeValue),
        makeComponent("GOOD_C", "simple_capacitor", "capacitance", 1e-6),
        makeComponent("GOOD_L", "simple_inductor", "inductance", 1e-3),
      ])

      expect(circuitJsonToSpice(circuitJson).toSpiceString()).toBe(
        [
          "* Circuit JSON to SPICE Netlist",
          "RGOOD_R N3 N4 1K",
          "CGOOD_C N7 N8 1U",
          "LGOOD_L N9 N10 1m",
          ".END",
        ].join("\n"),
      )
    })
  }
}

test("conversion preserves finite passive values and the zero-resistance clamp", () => {
  const circuitJson = makeCircuit([
    makeComponent("R_POS", "simple_resistor", "resistance", 2200),
    makeComponent("R_ZERO", "simple_resistor", "resistance", 0),
    makeComponent("R_NEG", "simple_resistor", "resistance", -2),
    makeComponent("C_POS", "simple_capacitor", "capacitance", 1e-6),
    makeComponent("C_ZERO", "simple_capacitor", "capacitance", 0),
    makeComponent("C_NEG", "simple_capacitor", "capacitance", -1e-6),
    makeComponent("L_POS", "simple_inductor", "inductance", 1e-3),
    makeComponent("L_ZERO", "simple_inductor", "inductance", 0),
    makeComponent("L_NEG", "simple_inductor", "inductance", -1e-3),
  ])

  expect(circuitJsonToSpice(circuitJson).toSpiceString()).toBe(
    [
      "* Circuit JSON to SPICE Netlist",
      "RR_POS N1 N2 2.2K",
      "RR_ZERO N3 N4 1e-12",
      "RR_NEG N5 N6 -2",
      "CC_POS N7 N8 1U",
      "CC_ZERO N9 N10 0",
      "CC_NEG N11 N12 -0.000001",
      "LL_POS N13 N14 1m",
      "LL_ZERO N15 N16 0",
      "LL_NEG N17 N18 -0.001",
      ".END",
    ].join("\n"),
  )
})
