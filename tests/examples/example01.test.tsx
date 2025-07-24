import { test, expect } from "bun:test"
import { sel } from "tscircuit"
import { getTestFixture } from "tests/fixtures/getTestFixture"
import { convertSpiceNetlistToString } from "lib/spice-utils/convertSpiceNetlistToString"

test("example01", async () => {
  const { circuit } = await getTestFixture()

  circuit.add(
    <board>
      <resistor name="R1" resistance="1k" />
      <capacitor
        name="C1"
        capacitance="1uF"
        connections={{
          pin1: sel.R1.pin1,
        }}
      />
      {/* Not supported in tscircuit yet */}
      {/* <powersource name="V1" voltage="1V" /> */}
    </board>,
  )

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()

  // Convert circuit JSON to SPICE
  const { circuitJsonToSpice } = await import("lib/circuitJsonToSpice")
  const spiceNetlist = circuitJsonToSpice(circuitJson)
  const spiceString = spiceNetlist.toSpiceString()

  expect(spiceString).toMatchInlineSnapshot(`
    "Circuit JSON to SPICE Netlist
    RR1 N1 N2 1K
    CC1 N1 N3 1U
    .END"
  `)
})
