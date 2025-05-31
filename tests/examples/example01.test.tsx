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

  // TODO convert circuitJson to spice netlist and take use expect(spiceString).toMatchInlineSnapshot()
})
