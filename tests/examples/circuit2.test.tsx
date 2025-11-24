import { test, expect } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import circuitWithUnrelatedVoltageSourceComponents from "./assets/circuit-with-unrelated-voltage-source-components.json"

test("circuit with unrelated voltage_source components", async () => {
  const circuitJson = circuitWithUnrelatedVoltageSourceComponents as any

  const spiceNetlist = circuitJsonToSpice(circuitJson)
  const spiceString = spiceNetlist.toSpiceString()

  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1_Test N1 N2 10K
    RR2_Test 0 N1 10K
    Vsimulation_voltage_source_0 N2 0 DC 3.3
    .END"
  `)
})
