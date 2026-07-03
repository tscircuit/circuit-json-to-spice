import { expect, test } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import dcVoltageSource from "./assets/dc-voltage-source-terminals.json"

// A DC voltage source that uses terminal1_source_port_id/terminal2_source_port_id
// (instead of positive/negative) should still emit its V line.
test("DC voltage source using terminal1/terminal2", () => {
  const spiceString = circuitJsonToSpice(dcVoltageSource as any).toSpiceString()

  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 N2 10K
    RR2 N2 0 10K
    Vsimulation_voltage_source_0 N1 0 DC 5
    .END"
  `)
})
