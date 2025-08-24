import { test, expect } from "bun:test"
import { getTestFixture } from "tests/fixtures/getTestFixture"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

test("AC voltage source", async () => {
  const { circuit } = await getTestFixture()

  circuit.add(
    <board width="10mm" height="10mm">
      <voltagesource
        name="VS1"
        voltage="5V"
        frequency="60Hz"
        waveShape="sinewave"
      />
      <resistor name="R1" resistance="10k" pcbY={-2} schY={-2} />
      <resistor name="R2" resistance="10k" pcbY={-2} schY={-2} />
      <trace from={".VS1 > .pin1"} to={".R1 > .pin1"} />
      <trace from={".R1 > .pin2"} to={".R2 > .pin1"} />
      <trace from={".VS1 > .pin2"} to={".R2 > .pin2"} />
    </board>,
  )

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()

  const spiceNetlist = circuitJsonToSpice(circuitJson)
  const spiceString = spiceNetlist.toSpiceString()

  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 N2 10K
    RR2 N2 0 10K
    Vsimulation_voltage_source_0 N1 0 SIN(0 5 60 0 0 0)
    .END"
  `)
})
