import { test, expect } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import currentSourceCircuit from "./assets/current-source.json"

test("Current source circuit", async () => {
  const circuitJson = currentSourceCircuit as any

  const spiceNetlist = circuitJsonToSpice(circuitJson)
  const spiceString = spiceNetlist.toSpiceString()

  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 N2 1K
    RR2 N3 N4 1K
    RR3 N5 N6 1K
    Isimulation_current_source_0 N1 N2 DC 1
    Isimulation_current_source_1 N3 N4 SIN(0 1 1000 0 0 0)
    Isimulation_current_source_2 N5 N6 PULSE(0 0.5 0 1n 1n 0.0025 0.01)
    .END"
  `)
})
