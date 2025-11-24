import { test, expect } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import simpleResistorDivider from "./assets/simple-resistor-divider.json"

test("simple resistor divider", async () => {
  const circuitJson = simpleResistorDivider as any

  const spiceNetlist = circuitJsonToSpice(circuitJson)
  const spiceString = spiceNetlist.toSpiceString()

  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 N2 1K
    RR2 N2 0 2K
    CC1 N2 0 10U
    Vsimulation_voltage_source_0 N1 0 DC 5
    .END"
  `)
})
