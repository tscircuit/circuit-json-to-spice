import { test, expect } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import circuitWithMultipleComponents from "./assets/circuit-with-multiple-components.json"
import circuit1SimpleResistorDivider from "./assets/circuit1-simple-resistor-divider.json"

test("circuit with multiple components", async () => {
  const circuitJson = circuitWithMultipleComponents as any
  const spiceNetlist = circuitJsonToSpice(circuitJson)
  const spiceString = spiceNetlist.toSpiceString()

  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 N2 10K
    RR2 N2 N3 5.6K
    CC1 N1 N4 100N
    CC2 N3 N5 1U
    .END"
  `)
})

test("simple resistor divider", async () => {
  const circuitJson = circuit1SimpleResistorDivider as any

  const spiceNetlist = circuitJsonToSpice(circuitJson)
  const spiceString = spiceNetlist.toSpiceString()

  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N2 N1 1K
    RR2 N1 N3 2K
    .END"
  `)
})
