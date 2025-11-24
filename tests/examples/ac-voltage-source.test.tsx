import { test, expect } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import acVoltageSource from "./assets/AC-voltage-source.json"

test(
  "AC voltage source",
  async () => {
    const circuitJson = acVoltageSource as any

    const spiceNetlist = circuitJsonToSpice(circuitJson)
    const spiceString = spiceNetlist.toSpiceString()

    expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 N2 10K
    RR2 N2 0 10K
    Vsimulation_voltage_source_0 N1 0 SIN(0 5 60 0 0 0)
    .END"
  `)
  },
  { timeout: 10000 },
)
