import { test, expect } from "bun:test"
import { sel } from "tscircuit"
import { getTestFixture } from "tests/fixtures/getTestFixture"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

test("complex circuit with multiple components", async () => {
  const { circuit } = await getTestFixture()

  circuit.add(
    <board>
      <resistor name="R1" resistance="10k" />
      <resistor name="R2" resistance="5.6k" />
      <capacitor name="C1" capacitance="100nF" />
      <capacitor name="C2" capacitance="1uF" />
      {/* Connect components */}
      <trace from={sel.R1.pin1} to={sel.C1.pin1} />
      <trace from={sel.R1.pin2} to={sel.R2.pin1} />
      <trace from={sel.R2.pin2} to={sel.C2.pin1} />
    </board>
  )

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  
  const spiceNetlist = circuitJsonToSpice(circuitJson)
  const spiceString = spiceNetlist.toSpiceString()
  
  expect(spiceString).toMatchInlineSnapshot(`
    "Circuit JSON to SPICE Netlist
    RR1 N1 N2 10K
    RR2 N2 N3 5.6K
    CC1 N1 N4 100N
    CC2 N3 N5 1U
    .END"
  `)
})

test("simple resistor divider", async () => {
  const { circuit } = await getTestFixture()

  circuit.add(
    <board>
      <resistor name="R1" resistance="1k" />
      <resistor name="R2" resistance="2k" />
      <trace from={sel.R1.pin2} to={sel.R2.pin1} />
    </board>
  )

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  
  const spiceNetlist = circuitJsonToSpice(circuitJson)
  const spiceString = spiceNetlist.toSpiceString()
  
  expect(spiceString).toMatchInlineSnapshot(`
    "Circuit JSON to SPICE Netlist
    RR1 N2 N1 1K
    RR2 N1 N3 2K
    .END"
  `)
})